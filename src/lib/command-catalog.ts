/**
 * Static command catalog for the public commands page and stats API.
 * Kept standalone (no discord.js imports) so it can render anywhere.
 * Keep in sync with src/bot/commands/index.ts.
 */
export interface CommandCatalogEntry {
  name: string;
  category: string;
  descriptionKey: string;
  aliases: string[];
  usage: string;
}

export const commandCatalog: CommandCatalogEntry[] = [
  // Music
  { name: "play", category: "music", descriptionKey: "commands.play.description", aliases: ["p"], usage: "play <query>" },
  { name: "playnext", category: "music", descriptionKey: "commands.playnext.description", aliases: ["pn"], usage: "playnext <query>" },
  { name: "playtop", category: "music", descriptionKey: "commands.playtop.description", aliases: ["pt"], usage: "playtop <query>" },
  { name: "playskip", category: "music", descriptionKey: "commands.playskip.description", aliases: ["ps"], usage: "playskip <query>" },
  { name: "pause", category: "music", descriptionKey: "commands.pause.description", aliases: [], usage: "pause" },
  { name: "resume", category: "music", descriptionKey: "commands.resume.description", aliases: ["unpause"], usage: "resume" },
  { name: "stop", category: "music", descriptionKey: "commands.stop.description", aliases: ["leave", "dc", "disconnect"], usage: "stop" },
  { name: "skip", category: "music", descriptionKey: "commands.skip.description", aliases: ["s", "sk", "fs"], usage: "skip" },
  { name: "previous", category: "music", descriptionKey: "commands.previous.description", aliases: ["prev", "back"], usage: "previous" },
  { name: "seek", category: "music", descriptionKey: "commands.seek.description", aliases: [], usage: "seek <position>" },
  { name: "forward", category: "music", descriptionKey: "commands.forward.description", aliases: ["fw"], usage: "forward <seconds>" },
  { name: "rewind", category: "music", descriptionKey: "commands.rewind.description", aliases: ["rw"], usage: "rewind <seconds>" },
  { name: "replay", category: "music", descriptionKey: "commands.replay.description", aliases: ["re"], usage: "replay" },
  { name: "join", category: "music", descriptionKey: "commands.join.description", aliases: ["j", "summon"], usage: "join" },
  { name: "queue", category: "music", descriptionKey: "commands.queue.description", aliases: ["q", "que"], usage: "queue [page]" },
  { name: "nowplaying", category: "music", descriptionKey: "commands.nowplaying.description", aliases: ["np", "now"], usage: "nowplaying" },
  { name: "remove", category: "music", descriptionKey: "commands.remove.description", aliases: ["rm"], usage: "remove <index>" },
  { name: "clear", category: "music", descriptionKey: "commands.clear.description", aliases: [], usage: "clear" },
  { name: "move", category: "music", descriptionKey: "commands.move.description", aliases: ["mv"], usage: "move <from> <to>" },
  { name: "shuffle", category: "music", descriptionKey: "commands.shuffle.description", aliases: ["sh", "mix"], usage: "shuffle" },
  { name: "skipto", category: "music", descriptionKey: "commands.skipto.description", aliases: ["st", "jump"], usage: "skipto <index>" },
  { name: "removeduplicates", category: "music", descriptionKey: "commands.removeduplicates.description", aliases: ["rdup", "removedupes"], usage: "removeduplicates" },
  { name: "sleep", category: "music", descriptionKey: "commands.sleep.description", aliases: ["timer"], usage: "sleep [minutes]" },
  { name: "loop", category: "music", descriptionKey: "commands.loop.description", aliases: ["l", "repeat"], usage: "loop [mode]" },
  { name: "volume", category: "music", descriptionKey: "commands.volume.description", aliases: ["vol", "v"], usage: "volume [level]" },
  { name: "search", category: "music", descriptionKey: "commands.search.description", aliases: ["find"], usage: "search <query>" },
  { name: "grab", category: "music", descriptionKey: "commands.grab.description", aliases: ["save"], usage: "grab" },
  { name: "lyrics", category: "music", descriptionKey: "commands.lyrics.description", aliases: ["ly"], usage: "lyrics" },
  { name: "autoplay", category: "music", descriptionKey: "commands.autoplay.description", aliases: ["ap"], usage: "autoplay" },
  { name: "247", category: "music", descriptionKey: "commands.247.description", aliases: ["stay"], usage: "247" },
  { name: "djmode", category: "music", descriptionKey: "commands.djmode.description", aliases: ["dj"], usage: "djmode" },
  // Playlists
  { name: "playlist", category: "playlists", descriptionKey: "commands.playlist.description", aliases: ["pl"], usage: "playlist <create|delete|rename|add|remove|list|info|load|save|public>" },
  { name: "favorites", category: "playlists", descriptionKey: "commands.favorites.description", aliases: ["fav", "favourites"], usage: "favorites <add|remove|list|play>" },
  // Filters
  { name: "bassboost", category: "filters", descriptionKey: "commands.bassboost.description", aliases: ["bass", "bb"], usage: "bassboost [level]" },
  { name: "nightcore", category: "filters", descriptionKey: "commands.nightcore.description", aliases: ["nc"], usage: "nightcore" },
  { name: "vaporwave", category: "filters", descriptionKey: "commands.vaporwave.description", aliases: ["vw"], usage: "vaporwave" },
  { name: "soft", category: "filters", descriptionKey: "commands.soft.description", aliases: [], usage: "soft" },
  { name: "8d", category: "filters", descriptionKey: "commands.8d.description", aliases: ["eightd"], usage: "8d" },
  { name: "karaoke", category: "filters", descriptionKey: "commands.karaoke.description", aliases: [], usage: "karaoke" },
  { name: "tremolo", category: "filters", descriptionKey: "commands.tremolo.description", aliases: [], usage: "tremolo" },
  { name: "vibrato", category: "filters", descriptionKey: "commands.vibrato.description", aliases: [], usage: "vibrato" },
  { name: "distortion", category: "filters", descriptionKey: "commands.distortion.description", aliases: [], usage: "distortion" },
  { name: "lowpass", category: "filters", descriptionKey: "commands.lowpass.description", aliases: ["lp"], usage: "lowpass" },
  { name: "speed", category: "filters", descriptionKey: "commands.speed.description", aliases: [], usage: "speed <value>" },
  { name: "pitch", category: "filters", descriptionKey: "commands.pitch.description", aliases: [], usage: "pitch <value>" },
  { name: "eq", category: "filters", descriptionKey: "commands.eq.description", aliases: ["equalizer"], usage: "eq <15 gains>" },
  { name: "filters", category: "filters", descriptionKey: "commands.filters.description", aliases: ["fx"], usage: "filters" },
  { name: "reset", category: "filters", descriptionKey: "commands.filtersreset.description", aliases: ["resetfilters", "clearfilters"], usage: "reset" },
  // Settings
  { name: "settings", category: "settings", descriptionKey: "commands.settings.description", aliases: ["config"], usage: "settings" },
  { name: "prefix", category: "settings", descriptionKey: "commands.prefix.description", aliases: [], usage: "prefix <new>" },
  { name: "language", category: "settings", descriptionKey: "commands.language.description", aliases: ["lang"], usage: "language <locale>" },
  { name: "djrole", category: "settings", descriptionKey: "commands.djrole.description", aliases: [], usage: "djrole <add|remove|list>" },
  { name: "botchannel", category: "settings", descriptionKey: "commands.botchannel.description", aliases: [], usage: "botchannel <add|remove|clear>" },
  { name: "defaultvolume", category: "settings", descriptionKey: "commands.defaultvolume.description", aliases: ["defvol"], usage: "defaultvolume <level>" },
  { name: "idletimeout", category: "settings", descriptionKey: "commands.idletimeout.description", aliases: ["idle"], usage: "idletimeout <minutes>" },
  // Info
  { name: "help", category: "info", descriptionKey: "commands.help.description", aliases: ["h", "commands"], usage: "help" },
  { name: "ping", category: "info", descriptionKey: "commands.ping.description", aliases: ["latency"], usage: "ping" },
  { name: "stats", category: "info", descriptionKey: "commands.stats.description", aliases: [], usage: "stats" },
  { name: "invite", category: "info", descriptionKey: "commands.invite.description", aliases: ["add"], usage: "invite" },
  { name: "about", category: "info", descriptionKey: "commands.about.description", aliases: ["info", "botinfo"], usage: "about" },
  { name: "nodes", category: "info", descriptionKey: "commands.nodes.description", aliases: ["node", "lavalink"], usage: "nodes" },
  { name: "developer", category: "info", descriptionKey: "commands.developer.description", aliases: ["dev", "shm", "credits"], usage: "developer" },
];

export const COMMAND_COUNT = commandCatalog.length;
