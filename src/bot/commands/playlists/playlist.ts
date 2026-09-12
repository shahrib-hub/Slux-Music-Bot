import type { BotCommand, CommandContext } from "@/bot/commands/types";
import { getOrCreatePlayer, requesterOf } from "@/bot/commands/helpers";
import { baseEmbed, errorEmbed, EMOJI, successEmbed, trackLine } from "@/bot/lib/embeds";
import {
  PlaylistModel,
  MAX_PLAYLIST_TRACKS,
  type PlaylistTrack,
} from "@/db/models/Playlist";
import type { ResolvedTrack } from "@/bot/music/types";
import { formatDuration } from "@/lib/utils";

function music(ctx: CommandContext) {
  return ctx.client.music;
}

function playlistDocToTrack(doc: PlaylistTrack): ResolvedTrack {
  return {
    encoded: doc.encoded,
    title: doc.title,
    author: doc.author,
    length: doc.length,
    uri: doc.uri,
    artwork: doc.artwork,
    sourceName: doc.sourceName,
    identifier: doc.identifier,
    isrc: doc.isrc,
    isStream: doc.isStream,
    isSeekable: !doc.isStream,
    requesterId: "playlist",
    requesterTag: "Playlist",
    requesterAvatar: "",
  };
}

function trackToDoc(track: ResolvedTrack): PlaylistTrack {
  return {
    encoded: track.encoded,
    title: track.title,
    author: track.author,
    length: track.length,
    uri: track.uri,
    artwork: track.artwork,
    sourceName: track.sourceName,
    isrc: track.isrc,
    identifier: track.identifier,
    isStream: track.isStream,
  };
}

/** Send a paginated view, falling back to a single page without a pager. */
async function replyPaged(
  ctx: CommandContext,
  totalPages: number,
  render: (page: number) => { embeds: import("discord.js").EmbedBuilder[] },
): Promise<void> {
  if (!ctx.pagination) {
    await ctx.reply({ embeds: render(1).embeds });
    return;
  }
  const id = ctx.pagination.create(totalPages, render);
  const view = ctx.pagination.build(id, 1);
  const message = await ctx.reply(view);
  ctx.pagination.attach(id, message);
}

async function loadPlaylistIntoQueue(ctx: CommandContext, name: string, ownerId: string): Promise<void> {
  const playlist = await PlaylistModel.findOne({ ownerId, name });
  if (!playlist) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.notFound", { name }))] });
    return;
  }
  if (playlist.tracks.length === 0) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.empty", { name }))] });
    return;
  }
  const player = await getOrCreatePlayer(ctx);
  if (!player) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noVoiceChannel"))] });
    return;
  }
  const requester = requesterOf(ctx);
  player.enqueueMany(playlist.tracks.map((t) => ({ ...playlistDocToTrack(t), ...requesterMeta(requester) })));
  if (!player.current) await player.startIfIdle();
  const totalMs = playlist.tracks.reduce((a, t) => a + t.length, 0);
  const embed = baseEmbed()
    .setAuthor({ name: `${EMOJI.playlist} ${ctx.t("playlists.loadedTitle")}` })
    .setTitle(name.slice(0, 250))
    .setDescription(ctx.t("playlists.loaded", { count: playlist.tracks.length, name }))
    .addFields(
      {
        name: `${EMOJI.cd} ${ctx.t("music.queueTotal")}`,
        value: `\`${player.queue.length}\` ${ctx.t("common.tracks")}`,
        inline: true,
      },
      { name: `${EMOJI.clock} ${ctx.t("music.totalDuration")}`, value: `\`${formatDuration(totalMs)}\``, inline: true },
    )
    .setFooter({ text: `${ctx.t("common.requestedBy", { user: ctx.author.tag })}`, iconURL: ctx.author.displayAvatarURL({ size: 64 }) });
  const first = playlist.tracks[0];
  if (first?.artwork) embed.setThumbnail(first.artwork);
  await ctx.reply({ embeds: [embed] });
}

function requesterMeta(requester: { id: string; tag: string; avatar: string }) {
  return {
    requesterId: requester.id,
    requesterTag: requester.tag,
    requesterAvatar: requester.avatar,
  };
}

async function addQueryToPlaylist(
  ctx: CommandContext,
  playlistName: string,
  query: string,
): Promise<void> {
  const playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name: playlistName });
  if (!playlist) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.notFound", { name: playlistName }))] });
    return;
  }
  const outcome = await music(ctx).resolve(query, requesterOf(ctx));
  if (outcome.kind === "empty" || outcome.kind === "error") {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
    return;
  }

  if (outcome.kind === "track" && outcome.track) {
    if (playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
      await ctx.reply({
        embeds: [errorEmbed(ctx.t, ctx.t("playlists.limitReached", { limit: MAX_PLAYLIST_TRACKS }))],
      });
      return;
    }
    playlist.tracks.push(trackToDoc(outcome.track));
    await playlist.save();
    await ctx.reply({
      embeds: [addedTrackEmbed(ctx, playlistName, outcome.track, playlist.tracks.length)],
    });
    return;
  }

  if (outcome.kind === "playlist" && outcome.tracks) {
    if (playlist.tracks.length + outcome.tracks.length > MAX_PLAYLIST_TRACKS) {
      await ctx.reply({
        embeds: [errorEmbed(ctx.t, ctx.t("playlists.tooManyToAdd", { limit: MAX_PLAYLIST_TRACKS }))],
      });
      return;
    }
    playlist.tracks.push(...outcome.tracks.map(trackToDoc));
    await playlist.save();
    await ctx.reply({
      embeds: [
        successEmbed(
          ctx.t,
          ctx.t("playlists.addedTracks", { count: outcome.tracks.length, name: playlistName }),
          `${EMOJI.playlist} ${ctx.t("playlists.addedTitle")}`,
        ),
      ],
    });
    return;
  }

  if (outcome.kind === "search" && outcome.tracks && outcome.tracks.length > 0) {
    const track = outcome.tracks[0];
    if (playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
      await ctx.reply({
        embeds: [errorEmbed(ctx.t, ctx.t("playlists.limitReached", { limit: MAX_PLAYLIST_TRACKS }))],
      });
      return;
    }
    playlist.tracks.push(trackToDoc(track));
    await playlist.save();
    await ctx.reply({ embeds: [addedTrackEmbed(ctx, playlistName, track, playlist.tracks.length)] });
  }
}

function addedTrackEmbed(ctx: CommandContext, playlistName: string, track: ResolvedTrack, total: number): import("discord.js").EmbedBuilder {
  const embed = baseEmbed()
    .setAuthor({ name: `${EMOJI.added} ${ctx.t("playlists.addedTitle")}` })
    .setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title)
    .setURL(track.uri || null)
    .setDescription(`**${track.author}** → 📁 **${playlistName}**`)
    .addFields({
      name: `${EMOJI.cd} ${ctx.t("playlists.infoTitle", { name: playlistName })}`,
      value: `\`${total}\` ${ctx.t("common.tracks")}`,
      inline: true,
    })
    .setFooter({ text: ctx.author.tag, iconURL: ctx.author.displayAvatarURL({ size: 64 }) });
  if (track.artwork) embed.setThumbnail(track.artwork);
  return embed;
}

/** Paginated playlist listing (8 per page). */
async function replyPlaylistList(ctx: CommandContext): Promise<void> {
  const playlists = await PlaylistModel.find({ ownerId: ctx.author.id }).limit(200);
  if (playlists.length === 0) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.listEmpty"))] });
    return;
  }
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(playlists.length / perPage));
  const t = ctx.t;
  const author = ctx.author;
  const render = (page: number) => {
    const start = (page - 1) * perPage;
    const items = playlists.slice(start, start + perPage);
    const embed = baseEmbed()
      .setAuthor({ name: `${EMOJI.playlist} ${t("playlists.listTitle")}`, iconURL: author.displayAvatarURL({ size: 64 }) })
      .setDescription(
        items
          .map((p) => {
            const duration = p.tracks.reduce((a, tr) => a + tr.length, 0);
            const visibility = p.public ? `🔓 ${t("playlists.public")}` : `🔒 ${t("playlists.private")}`;
            const desc = p.description ? `\n> *${p.description.slice(0, 90)}*` : "";
            return `**${p.name}** ${visibility}\n> ${EMOJI.cd} \`${p.tracks.length}\` ${t("common.tracks")} • ${EMOJI.clock} \`${formatDuration(duration)}\`${desc}`;
          })
          .join("\n\n"),
      )
      .setFooter({ text: `${t("common.page", { current: page, total: totalPages })} • ${playlists.length} ${t("playlists.listTitle").toLowerCase()}` });
    return { embeds: [embed] };
  };

  await replyPaged(ctx, totalPages, render);
}

/** Paginated playlist track listing (10 per page). */
async function replyPlaylistInfo(ctx: CommandContext, name: string): Promise<void> {
  const playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name });
  if (!playlist) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.notFound", { name }))] });
    return;
  }
  const totalMs = playlist.tracks.reduce((a, t) => a + t.length, 0);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(playlist.tracks.length / perPage));
  const t = ctx.t;
  const tracks = [...playlist.tracks];
  const render = (page: number) => {
    const start = (page - 1) * perPage;
    const items = tracks.slice(start, start + perPage);
    const embed = baseEmbed()
      .setAuthor({ name: `${EMOJI.playlist} ${t("playlists.infoTitle", { name })}` })
      .setDescription(
        playlist.tracks.length === 0
          ? t("playlists.empty", { name })
          : items.map((tr, i) => trackLine(playlistDocToTrack(tr), start + i + 1)).join("\n").slice(0, 3900),
      )
      .setFooter({
        text: `${t("playlists.infoFooter", {
          count: playlist.tracks.length,
          duration: formatDuration(totalMs),
          visibility: playlist.public ? t("playlists.public") : t("playlists.private"),
        })} • ${t("common.page", { current: page, total: totalPages })}`,
      });
    return { embeds: [embed] };
  };

  await replyPaged(ctx, totalPages, render);
}

export const playlistCommand: BotCommand = {
  name: "playlist",
  descriptionKey: "commands.playlist.description",
  category: "playlists",
  aliases: ["pl"],
  subcommands: [
    { name: "create", descriptionKey: "commands.playlist.subcommands.create.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.create.options.name", type: "string", required: true, rest: true }] },
    { name: "delete", descriptionKey: "commands.playlist.subcommands.delete.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.delete.options.name", type: "string", required: true, rest: true }] },
    { name: "rename", descriptionKey: "commands.playlist.subcommands.rename.description", options: [
      { name: "old", descriptionKey: "commands.playlist.subcommands.rename.options.old", type: "string", required: true },
      { name: "new", descriptionKey: "commands.playlist.subcommands.rename.options.new", type: "string", required: true, rest: true },
    ] },
    { name: "add", descriptionKey: "commands.playlist.subcommands.add.description", options: [
      { name: "name", descriptionKey: "commands.playlist.subcommands.add.options.name", type: "string", required: true },
      { name: "query", descriptionKey: "commands.playlist.subcommands.add.options.query", type: "string", required: true, rest: true },
    ] },
    { name: "remove", descriptionKey: "commands.playlist.subcommands.remove.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.remove.options.name", type: "string", required: true }, { name: "index", descriptionKey: "commands.playlist.subcommands.remove.options.index", type: "integer", required: true, min: 1 }] },
    { name: "list", descriptionKey: "commands.playlist.subcommands.list.description" },
    { name: "info", descriptionKey: "commands.playlist.subcommands.info.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.info.options.name", type: "string", required: true, rest: true }] },
    { name: "load", descriptionKey: "commands.playlist.subcommands.load.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.load.options.name", type: "string", required: true, rest: true }] },
    { name: "public", descriptionKey: "commands.playlist.subcommands.public.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.public.options.name", type: "string", required: true, rest: true }] },
    { name: "save", descriptionKey: "commands.playlist.subcommands.save.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.save.options.name", type: "string", required: true, rest: true }] },
  ],
  async execute(ctx: CommandContext) {
    const sub = ctx.subcommand ?? "";
    switch (sub) {
      case "create": {
        const name = String(ctx.options.name ?? "").trim();
        if (!name || name.length > 64) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.nameTooLong"))] });
          return;
        }
        const exists = await PlaylistModel.findOne({ ownerId: ctx.author.id, name });
        if (exists) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.exists", { name }))] });
          return;
        }
        await PlaylistModel.create({ ownerId: ctx.author.id, name, tracks: [] });
        await ctx.reply({
          embeds: [successEmbed(ctx.t, ctx.t("playlists.created", { name }), `${EMOJI.playlist} ${ctx.t("playlists.createdTitle")}`)],
        });
        return;
      }
      case "delete": {
        const name = String(ctx.options.name ?? "").trim();
        const deleted = await PlaylistModel.findOneAndDelete({ ownerId: ctx.author.id, name });
        if (!deleted) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.notFound", { name }))] });
          return;
        }
        await ctx.reply({
          embeds: [
            baseEmbed()
              .setAuthor({ name: `${EMOJI.error} ${ctx.t("playlists.deletedTitle")}` })
              .setDescription(ctx.t("playlists.deleted", { name })),
          ],
        });
        return;
      }
      case "rename": {
        const oldName = String(ctx.options.old ?? "").trim();
        const newName = String(ctx.options.new ?? "").trim();
        if (!newName || newName.length > 64) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.nameTooLong"))] });
          return;
        }
        const playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name: oldName });
        if (!playlist) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.notFound", { name: oldName }))] });
          return;
        }
        const clash = await PlaylistModel.findOne({ ownerId: ctx.author.id, name: newName });
        if (clash) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.exists", { name: newName }))] });
          return;
        }
        playlist.name = newName;
        await playlist.save();
        await ctx.reply({
          embeds: [
            successEmbed(ctx.t, ctx.t("playlists.renamed", { old: oldName, new: newName }), `${EMOJI.playlist} ${ctx.t("playlists.renamedTitle")}`),
          ],
        });
        return;
      }
      case "add": {
        const name = String(ctx.options.name ?? "").trim();
        const query = String(ctx.options.query ?? "").trim();
        if (!query) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.noCurrent"))] });
          return;
        }
        await addQueryToPlaylist(ctx, name, query);
        return;
      }
      case "remove": {
        const name = String(ctx.options.name ?? "").trim();
        const index = Number(ctx.options.index ?? 0);
        const playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name });
        if (!playlist) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.notFound", { name }))] });
          return;
        }
        if (index < 1 || index > playlist.tracks.length) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.invalidIndex", { index }))] });
          return;
        }
        const [removed] = playlist.tracks.splice(index - 1, 1);
        await playlist.save();
        await ctx.reply({
          embeds: [
            baseEmbed()
              .setAuthor({ name: `${EMOJI.error} ${ctx.t("playlists.removedTrackTitle")}` })
              .setDescription(ctx.t("playlists.removedTrack", { title: `**${removed?.title ?? "?"}**`, name })),
          ],
        });
        return;
      }
      case "list": {
        await replyPlaylistList(ctx);
        return;
      }
      case "info": {
        const name = String(ctx.options.name ?? "").trim();
        await replyPlaylistInfo(ctx, name);
        return;
      }
      case "load":
      case "play": {
        const name = String(ctx.options.name ?? "").trim();
        await loadPlaylistIntoQueue(ctx, name, ctx.author.id);
        return;
      }
      case "public": {
        const name = String(ctx.options.name ?? "").trim();
        const playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name });
        if (!playlist) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.notFound", { name }))] });
          return;
        }
        playlist.public = !playlist.public;
        await playlist.save();
        await ctx.reply({
          embeds: [
            baseEmbed()
              .setAuthor({ name: `${playlist.public ? "🔓" : "🔒"} ${ctx.t("playlists.visibilityTitle")}` })
              .setDescription(
                `${playlist.public ? "🔓" : "🔒"} **${name}** — ${
                  playlist.public ? ctx.t("playlists.public") : ctx.t("playlists.private")
                }`,
              ),
          ],
        });
        return;
      }
      case "save": {
        const name = String(ctx.options.name ?? "").trim();
        if (!name || name.length > 64) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.nameTooLong"))] });
          return;
        }
        const player = music(ctx).getPlayer(ctx.guild?.id ?? "");
        const tracks: ResolvedTrack[] = [];
        if (player?.current) tracks.push(player.current);
        if (player) tracks.push(...player.queue);
        if (tracks.length === 0) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.nothingToSave"))] });
          return;
        }
        const docs = tracks.map(trackToDoc).slice(0, MAX_PLAYLIST_TRACKS);
        const existing = await PlaylistModel.findOne({ ownerId: ctx.author.id, name });
        if (existing) {
          existing.set("tracks", docs);
          await existing.save();
          await ctx.reply({
            embeds: [
              successEmbed(
                ctx.t,
                ctx.t("playlists.savedQueueUpdated", { name, count: docs.length }),
                `${EMOJI.playlist} ${ctx.t("playlists.savedQueueTitle")}`,
              ),
            ],
          });
          return;
        }
        await PlaylistModel.create({ ownerId: ctx.author.id, name, tracks: docs });
        await ctx.reply({
          embeds: [
            successEmbed(
              ctx.t,
              ctx.t("playlists.savedQueue", { name, count: docs.length }),
              `${EMOJI.playlist} ${ctx.t("playlists.savedQueueTitle")}`,
            ),
          ],
        });
        return;
      }
      default:
        await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.unknownCommand"))] });
    }
  },
};

const FAVORITES = "Favorites";

export const favoritesCommand: BotCommand = {
  name: "favorites",
  descriptionKey: "commands.favorites.description",
  category: "playlists",
  aliases: ["fav", "favourites"],
  subcommands: [
    { name: "add", descriptionKey: "commands.favorites.subcommands.add.description", options: [{ name: "query", descriptionKey: "commands.favorites.subcommands.add.options.query", type: "string", rest: true }] },
    { name: "remove", descriptionKey: "commands.favorites.subcommands.remove.description", options: [{ name: "index", descriptionKey: "commands.favorites.subcommands.remove.options.index", type: "integer", required: true, min: 1 }] },
    { name: "list", descriptionKey: "commands.favorites.subcommands.list.description" },
    { name: "play", descriptionKey: "commands.favorites.subcommands.play.description" },
  ],
  async execute(ctx: CommandContext) {
    const sub = ctx.subcommand ?? "";
    switch (sub) {
      case "add": {
        const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
        let track: ResolvedTrack | null = null;
        if (!query) {
          const player = music(ctx).getPlayer(ctx.guild?.id ?? "");
          track = player?.current ?? null;
          if (!track) {
            await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.noCurrent"))] });
            return;
          }
        } else {
          const outcome = await music(ctx).resolve(query, requesterOf(ctx));
          if (outcome.kind === "track" && outcome.track) track = outcome.track;
          else if (outcome.kind === "search" && outcome.tracks?.length) track = outcome.tracks[0];
          if (!track) {
            await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
            return;
          }
        }
        let playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name: FAVORITES });
        if (!playlist) {
          playlist = await PlaylistModel.create({ ownerId: ctx.author.id, name: FAVORITES, tracks: [] });
        }
        if (playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
          await ctx.reply({
            embeds: [errorEmbed(ctx.t, ctx.t("playlists.limitReached", { limit: MAX_PLAYLIST_TRACKS }))],
          });
          return;
        }
        playlist.tracks.push(trackToDoc(track));
        await playlist.save();
        await ctx.reply({
          embeds: [
            successEmbed(ctx.t, ctx.t("playlists.favoritesAdded", { title: `**${track.title}**` }), `${EMOJI.heart} ${ctx.t("playlists.favorites")}`),
          ],
        });
        return;
      }
      case "remove": {
        const index = Number(ctx.options.index ?? 0);
        const playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name: FAVORITES });
        if (!playlist || index < 1 || index > playlist.tracks.length) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.invalidIndex", { index }))] });
          return;
        }
        const [removed] = playlist.tracks.splice(index - 1, 1);
        await playlist.save();
        await ctx.reply({
          embeds: [
            baseEmbed()
              .setAuthor({ name: `${EMOJI.error} ${ctx.t("playlists.favorites")}` })
              .setDescription(ctx.t("playlists.favoritesRemoved", { title: `**${removed?.title ?? "?"}**` })),
          ],
        });
        return;
      }
      case "list": {
        const playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name: FAVORITES });
        if (!playlist || playlist.tracks.length === 0) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.favoritesEmpty"))] });
          return;
        }
        const perPage = 10;
        const totalPages = Math.max(1, Math.ceil(playlist.tracks.length / perPage));
        const t = ctx.t;
        const tracks = [...playlist.tracks];
        const render = (page: number) => {
          const start = (page - 1) * perPage;
          const items = tracks.slice(start, start + perPage);
          const embed = baseEmbed()
            .setAuthor({ name: `${EMOJI.heart} ${t("playlists.favorites")}`, iconURL: ctx.author.displayAvatarURL({ size: 64 }) })
            .setDescription(items.map((tr, i) => trackLine(playlistDocToTrack(tr), start + i + 1)).join("\n").slice(0, 3900))
            .setFooter({
              text: `${playlist.tracks.length} ${t("common.tracks")} • ${t("common.page", { current: page, total: totalPages })}`,
            });
          return { embeds: [embed] };
        };
        await replyPaged(ctx, totalPages, render);
        return;
      }
      case "play": {
        await loadPlaylistIntoQueue(ctx, FAVORITES, ctx.author.id);
        return;
      }
      default:
        await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.unknownCommand"))] });
    }
  },
};
