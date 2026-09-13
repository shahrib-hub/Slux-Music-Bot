import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);

// server.ts
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

// src/bot/bot.ts
import { EventEmitter } from "node:events";
import {
  ActionRowBuilder as ActionRowBuilder7,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags as MessageFlags2,
  Partials,
  PermissionFlagsBits as PermissionFlagsBits3,
  ButtonBuilder as ButtonBuilder7,
  ButtonStyle as ButtonStyle7,
  Collection
} from "discord.js";
import { Shoukaku, Connectors } from "shoukaku";

// src/bot/music/MusicManager.ts
import { PermissionFlagsBits, Routes } from "discord.js";

// src/bot/music/filters.ts
var BASSBOOST_LEVELS = {
  low: 0.15,
  medium: 0.35,
  high: 0.65,
  insane: 0.9
};
var EQ_BANDS = 15;
function bands(gains) {
  return gains.slice(0, EQ_BANDS).map((gain, band) => ({
    band,
    gain: Math.max(-1, Math.min(1, gain))
  }));
}
function buildFilters(active) {
  const filters = {};
  if (active.bassboost !== void 0) {
    const gain = typeof active.bassboost === "number" ? active.bassboost : 0.35;
    filters.equalizer = bands([gain, gain, gain * 0.9, gain * 0.7, gain * 0.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }
  if (active.eq !== void 0 && Array.isArray(active.eq)) {
    filters.equalizer = bands(active.eq);
  }
  if (active.soft !== void 0) {
    const g = 0.25;
    filters.equalizer = bands([-g, -g * 0.75, -g * 0.5, 0, g * 0.4, g * 0.55, g * 0.65, g * 0.7, g * 0.75, g * 0.75, g * 0.7, g * 0.6, g * 0.5, g * 0.35, g * 0.2]);
  }
  if (active.nightcore !== void 0) {
    filters.timescale = { speed: 1.25, pitch: 1.3, rate: 1 };
  }
  if (active.vaporwave !== void 0) {
    filters.timescale = { speed: 0.75, pitch: 0.85, rate: 1 };
  }
  if (active.speed !== void 0 || active.pitch !== void 0) {
    const ts = { ...active.speed !== void 0 ? { speed: active.speed } : {}, ...active.pitch !== void 0 ? { pitch: active.pitch } : {} };
    filters.timescale = { ...ts, rate: 1 };
  }
  if (active["8d"] !== void 0) {
    filters.rotation = { rotationHz: 0.2 };
  }
  if (active.karaoke !== void 0) {
    filters.karaoke = { level: 1.1, monoLevel: 1.1, filterBand: 220, filterWidth: 100 };
  }
  if (active.tremolo !== void 0) {
    filters.tremolo = { frequency: 14, depth: 0.3 };
  }
  if (active.vibrato !== void 0) {
    filters.vibrato = { frequency: 14, depth: 0.3 };
  }
  if (active.distortion !== void 0) {
    filters.distortion = {
      sinOffset: 0,
      sinScale: 1,
      cosOffset: 0,
      cosScale: 1,
      tanOffset: 0,
      tanScale: 1,
      offset: 0,
      scale: 1
    };
  }
  if (active.lowpass !== void 0) {
    filters.lowPass = { smoothing: 20 };
  }
  return filters;
}
function activeFilterNames(filters) {
  const names = [];
  if (filters.equalizer) {
    const gains = filters.equalizer.map((b) => b.gain);
    const bass = gains.slice(0, 3);
    const treble = gains.slice(9);
    const avgBass = bass.reduce((a, b) => a + b, 0) / Math.max(1, bass.length);
    const avgTreble = treble.reduce((a, b) => a + b, 0) / Math.max(1, treble.length);
    if (avgBass > 0.1 && avgTreble <= 0.1) names.push("bassboost");
    else if (avgBass < -0.05 && avgTreble > 0.05) names.push("soft");
    else if (gains.some((g) => g !== 0)) names.push("eq");
  }
  if (filters.timescale) {
    const { speed, pitch } = filters.timescale;
    if (speed === 1.25 && pitch === 1.3) names.push("nightcore");
    else if (speed === 0.75 && pitch === 0.85) names.push("vaporwave");
    else names.push(`speed/pitch`);
  }
  if (filters.rotation) names.push("8d");
  if (filters.karaoke) names.push("karaoke");
  if (filters.tremolo) names.push("tremolo");
  if (filters.vibrato) names.push("vibrato");
  if (filters.distortion) names.push("distortion");
  if (filters.lowPass) names.push("lowpass");
  return names;
}
var TOGGLEABLE_FILTERS = [
  "bassboost",
  "nightcore",
  "vaporwave",
  "soft",
  "8d",
  "karaoke",
  "tremolo",
  "vibrato",
  "distortion",
  "lowpass"
];

// src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1e3);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
function formatDurationLong(ms) {
  const totalSeconds = Math.floor(ms / 1e3);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${totalSeconds % 60}s`);
  return parts.join(" ");
}
function formatNumber(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

// src/i18n/locales/en.json
var en_default = {
  common: {
    error: "Something went wrong. Please try again.",
    errorTitle: "Error",
    doneTitle: "Done",
    warnTitle: "Heads up",
    noVoiceChannel: "You need to join a voice channel first.",
    noPlayer: "Nothing is playing right now.",
    notInSameVoice: "You must be in the same voice channel as me.",
    queueEmpty: "The queue is empty.",
    cancelled: "Cancelled.",
    timeUp: "Time expired.",
    djRequired: "You need a DJ role or the Manage Channels permission to use this command.",
    manageGuildRequired: "You need the Manage Server permission to use this command.",
    blacklisted: "You are not allowed to use this bot.",
    nothingFound: "Nothing found for that query.",
    invalidNumber: "Please provide a valid number.",
    page: "Page {current}/{total}",
    requestedBy: "Requested by {user}",
    unknownCommand: "Unknown command. Try `{prefix}help`.",
    yes: "Yes",
    no: "No",
    on: "ON",
    off: "OFF",
    enabled: "Enabled",
    disabled: "Disabled",
    none: "None",
    minutes: "minutes",
    tracks: "tracks",
    commands: "commands",
    viewExpired: "This view has expired \u2014 run the command again for a fresh one.",
    cooldown: "You're using commands too quickly \u2014 try again in a few seconds.",
    channelNotAllowed: "Commands are not allowed in this channel.",
    mentionHelp: {
      title: "Hi, I'm Slux!",
      description: "Your server's music bot \u2014 search, queue, lyrics, filters and a live web dashboard. Here's how to use me:",
      prefixField: "Prefix here",
      prefixValue: "Use {prefix} before commands, e.g. {prefix}play",
      slashField: "Slash commands",
      slashValue: "Type `/` anywhere and pick a command.",
      popularField: "Popular commands",
      tipField: "Tip",
      tipValue: "Mention me for this message anytime, or run {prefix}help for the full list.",
      commandsButton: "All commands",
      dashboardButton: "Dashboard",
      inviteButton: "Invite me"
    }
  },
  commands: {
    "247": {
      name: "247",
      description: "Toggle staying in the voice channel 24/7"
    },
    play: {
      name: "play",
      description: "Play a song, playlist, or search query",
      options: {
        query: "Song name, URL, or playlist link"
      }
    },
    playnext: {
      name: "playnext",
      description: "Add a song to play right after the current one",
      options: {
        query: "Song name or URL"
      }
    },
    playtop: {
      name: "playtop",
      description: "Add a song to the top of the queue",
      options: {
        query: "Song name or URL"
      }
    },
    playskip: {
      name: "playskip",
      description: "Add a song to the top and skip to it immediately",
      options: {
        query: "Song name or URL"
      }
    },
    pause: {
      name: "pause",
      description: "Pause the current song"
    },
    resume: {
      name: "resume",
      description: "Resume the paused song"
    },
    stop: {
      name: "stop",
      description: "Stop playing, clear the queue and leave"
    },
    skip: {
      name: "skip",
      description: "Skip the current song"
    },
    previous: {
      name: "previous",
      description: "Play the previous song from history"
    },
    seek: {
      name: "seek",
      description: "Seek to a position in the current song",
      options: {
        position: "Position like 1:30, 90, or 1m30s"
      }
    },
    forward: {
      name: "forward",
      description: "Fast forward by a number of seconds",
      options: {
        seconds: "Seconds to fast forward"
      }
    },
    rewind: {
      name: "rewind",
      description: "Rewind by a number of seconds",
      options: {
        seconds: "Seconds to rewind"
      }
    },
    queue: {
      name: "queue",
      description: "Show the current queue",
      options: {
        page: "Page number"
      }
    },
    nowplaying: {
      name: "nowplaying",
      description: "Show the song that is currently playing"
    },
    remove: {
      name: "remove",
      description: "Remove a song from the queue",
      options: {
        index: "The queue position to remove"
      }
    },
    clear: {
      name: "clear",
      description: "Clear the entire queue"
    },
    move: {
      name: "move",
      description: "Move a song within the queue",
      options: {
        from: "Position to move from",
        to: "Position to move to"
      }
    },
    shuffle: {
      name: "shuffle",
      description: "Shuffle the queue"
    },
    loop: {
      name: "loop",
      description: "Set the loop mode",
      options: {
        mode: "Loop mode: off, track, or queue"
      }
    },
    volume: {
      name: "volume",
      description: "Set or view the volume",
      options: {
        level: "Volume from 0 to 150"
      }
    },
    join: {
      name: "join",
      description: "Join your voice channel"
    },
    replay: {
      name: "replay",
      description: "Replay the current song from the start"
    },
    grab: {
      name: "grab",
      description: "Get the current song in your DMs"
    },
    search: {
      name: "search",
      description: "Search for songs and pick one",
      options: {
        query: "What to search for"
      }
    },
    lyrics: {
      name: "lyrics",
      description: "Show lyrics for the current song"
    },
    autoplay: {
      name: "autoplay",
      description: "Toggle autoplay of related songs"
    },
    djmode: {
      name: "djmode",
      description: "Toggle DJ mode: only voice members can control the bot"
    },
    playlist: {
      name: "playlist",
      description: "Manage your playlists",
      subcommands: {
        create: {
          description: "Create a new playlist",
          options: {
            name: "Playlist name"
          }
        },
        delete: {
          description: "Delete one of your playlists",
          options: {
            name: "Playlist name"
          }
        },
        rename: {
          description: "Rename one of your playlists",
          options: {
            old: "Current name",
            new: "New name"
          }
        },
        add: {
          description: "Add a song or playlist link to a playlist",
          options: {
            name: "Playlist name",
            query: "Song or URL"
          }
        },
        remove: {
          description: "Remove a track from a playlist by position",
          options: {
            name: "Playlist name",
            index: "Track position"
          }
        },
        list: {
          description: "List your playlists"
        },
        info: {
          description: "Show the tracks of a playlist",
          options: {
            name: "Playlist name"
          }
        },
        load: {
          description: "Load a playlist into the queue",
          options: {
            name: "Playlist name"
          }
        },
        public: {
          description: "Toggle a playlist between public and private",
          options: {
            name: "Playlist name"
          }
        },
        save: {
          description: "Save the current queue as a playlist",
          options: {
            name: "Name for the playlist"
          }
        }
      }
    },
    favorites: {
      name: "favorites",
      description: "Manage your favorite songs",
      subcommands: {
        add: {
          description: "Add the current song or a query to your favorites",
          options: {
            query: "Song name or URL (empty = current song)"
          }
        },
        remove: {
          description: "Remove a favorite by position",
          options: {
            index: "Favorite position"
          }
        },
        list: {
          description: "List your favorites"
        },
        play: {
          description: "Play your favorites"
        }
      }
    },
    bassboost: {
      name: "bassboost",
      description: "Toggle the bassboost filter",
      options: {
        level: "Level: low, medium, high, or insane"
      }
    },
    nightcore: {
      name: "nightcore",
      description: "Toggle the nightcore filter"
    },
    vaporwave: {
      name: "vaporwave",
      description: "Toggle the vaporwave filter"
    },
    soft: {
      name: "soft",
      description: "Toggle the soft filter"
    },
    "8d": {
      name: "8d",
      description: "Toggle the 8D audio filter"
    },
    karaoke: {
      name: "karaoke",
      description: "Toggle the karaoke filter"
    },
    tremolo: {
      name: "tremolo",
      description: "Toggle the tremolo filter"
    },
    vibrato: {
      name: "vibrato",
      description: "Toggle the vibrato filter"
    },
    distortion: {
      name: "distortion",
      description: "Toggle the distortion filter"
    },
    lowpass: {
      name: "lowpass",
      description: "Toggle the lowpass filter"
    },
    speed: {
      name: "speed",
      description: "Set the playback speed",
      options: {
        value: "Speed from 0.5 to 5.0"
      }
    },
    pitch: {
      name: "pitch",
      description: "Set the pitch",
      options: {
        value: "Pitch from 0.5 to 5.0"
      }
    },
    eq: {
      name: "eq",
      description: "Set a custom equalizer like 3 0 0 1 0 -1",
      options: {
        bands: "15 gains from -1 to 1"
      }
    },
    filters: {
      name: "filters",
      description: "Show active filters"
    },
    filtersreset: {
      name: "reset",
      description: "Reset all filters"
    },
    settings: {
      name: "settings",
      description: "Show the server settings"
    },
    prefix: {
      name: "prefix",
      description: "Set the command prefix for this server",
      options: {
        prefix: "New prefix, up to 5 characters"
      }
    },
    language: {
      name: "language",
      description: "Set the bot language for this server",
      options: {
        language: "Language to use"
      }
    },
    djrole: {
      name: "djrole",
      description: "Manage DJ roles",
      subcommands: {
        add: {
          description: "Add a DJ role",
          options: {
            role: "The role"
          }
        },
        remove: {
          description: "Remove a DJ role",
          options: {
            role: "The role"
          }
        },
        list: {
          description: "List DJ roles"
        }
      }
    },
    botchannel: {
      name: "botchannel",
      description: "Restrict music commands to specific channels",
      subcommands: {
        add: {
          description: "Allow a channel",
          options: {
            channel: "The channel"
          }
        },
        remove: {
          description: "Disallow a channel",
          options: {
            channel: "The channel"
          }
        },
        clear: {
          description: "Allow all channels"
        }
      }
    },
    defaultvolume: {
      name: "defaultvolume",
      description: "Set the default volume for this server",
      options: {
        level: "Volume from 0 to 150"
      }
    },
    idletimeout: {
      name: "idletimeout",
      description: "Set how long to wait before leaving when idle",
      options: {
        minutes: "Minutes, 0 to disable"
      }
    },
    help: {
      name: "help",
      description: "Show the help menu"
    },
    ping: {
      name: "ping",
      description: "Show the bot latency"
    },
    stats: {
      name: "stats",
      description: "Show bot statistics"
    },
    invite: {
      name: "invite",
      description: "Get the bot invite link"
    },
    about: {
      name: "about",
      description: "Show info about Slux"
    },
    skipto: {
      description: "Skip to a specific track in the queue",
      options: {
        index: "Queue position to jump to"
      }
    },
    removeduplicates: {
      description: "Remove duplicate tracks from the queue"
    },
    sleep: {
      description: "Pause playback after a delay (sleep timer)",
      options: {
        minutes: "Minutes until pause (0 or off to cancel)"
      }
    },
    nodes: {
      description: "Show the status of the music nodes"
    },
    developer: {
      description: "Meet the developer behind Slux"
    }
  },
  music: {
    nowPlaying: "Now Playing",
    pausedLabel: "Paused",
    searching: "Searching...",
    added: "Added **{title}** to the queue",
    addedAt: "Added **{title}** to position #{position} of the queue",
    addedPlaylist: "Added **{count}** tracks from **{name}** to the queue",
    addedTitle: "Added to queue",
    addedTopTitle: "Added to top",
    skipPlayTitle: "Skipping to",
    playlistAddedTitle: "Playlist added",
    queuePosition: "Position",
    queueTotal: "Queue",
    totalDuration: "Total length",
    selectPrompt: "Select a track \u2014 results for `{query}`",
    selectButton: "Pick",
    cancelButton: "Cancel",
    searchResultsTitle: "Search results",
    selectFooter: "Pick a track below",
    selectPlaceholder: "Pick a track\u2026",
    paused: "Paused the player.",
    resumed: "Resumed the player.",
    alreadyPaused: "The player is already paused.",
    notPaused: "The player is not paused.",
    stopped: "Stopped the player and left the channel.",
    stoppedTitle: "Stopped",
    skipped: "Skipped **{title}**.",
    skippedTitle: "Skipped",
    noPrevious: "There is no previous song.",
    previousNow: "Now playing the previous song.",
    previousTitle: "Previous track",
    queueTitle: "Queue for {guild}",
    queueNowPlaying: "**Now Playing** \u2014 [{title}]({uri}) `{duration}`",
    queueUpNext: "Up Next",
    queueFooter: "{count} tracks \u2022 {duration} total",
    queueJumpTo: "Jump to page\u2026",
    queuePageOption: "Page {page}",
    npLength: "Length",
    npPosition: "Position",
    npProgress: "Progress",
    npVolume: "Volume",
    npLoop: "Loop",
    npFilters: "Filters",
    live: "LIVE",
    stream: "Live stream",
    removed: "Removed **{title}** from the queue.",
    removedTitle: "Removed",
    invalidIndex: "There is no track at position #{index}.",
    cleared: "Cleared the queue ({count} tracks).",
    clearedTitle: "Queue cleared",
    moved: "Moved **{title}** from #{from} to #{to}.",
    movedTitle: "Track moved",
    shuffled: "Shuffled the queue ({count} tracks).",
    shuffledTitle: "Shuffled",
    loopOff: "Loop is now **off**.",
    loopTrack: "Now looping the **current track**.",
    loopQueue: "Now looping the **queue**.",
    loopTitle: "Loop mode",
    loopCurrent: "Loop mode is {mode}",
    loopModeOff: "Off",
    loopModeTrack: "Track",
    loopModeQueue: "Queue",
    volumeSet: "Volume set to **{level}%**.",
    volumeCurrent: "Volume is currently **{level}%**.",
    volumeTitle: "Volume",
    volDown: "Volume \u221210",
    volUp: "Volume +10",
    volMute: "Mute",
    pausedTitle: "Paused",
    resumedTitle: "Resumed",
    seeked: "Seeked to **{position}**.",
    seekedTitle: "Seeked",
    seekInvalid: "Invalid position \u2014 the song is only {length} long.",
    forwarded: "Forwarded to **{position}**.",
    forwardedTitle: "Forwarded",
    rewound: "Rewound to **{position}**.",
    rewoundTitle: "Rewound",
    replaying: "Replaying the current song.",
    replayingTitle: "Replaying",
    joined: "Joined **{channel}**.",
    joinedTitle: "Joined voice",
    joinFailed: "I could not join that voice channel.",
    grabTitle: "Song grabbed",
    grabDmed: "I sent you the current song in your DMs.",
    grabDmFailed: "I could not DM you \u2014 please enable DMs from server members.",
    grabSource: "Source",
    lyricsTitle: "Lyrics for {title}",
    lyricsNone: "No lyrics found for the current song.",
    lyricsSynced: "Synced",
    lyricsPlain: "Plain",
    autoplayOn: "Autoplay is now **enabled** \u2014 I will keep playing related songs.",
    autoplayOff: "Autoplay is now **disabled**.",
    autoplayLabel: "Autoplay",
    stayOn: "24/7 mode is now **enabled** \u2014 I will stay in the channel.",
    stayOff: "24/7 mode is now **disabled**.",
    djmodeOn: "DJ mode is now **enabled** \u2014 only listeners in the voice channel can control me.",
    djmodeOff: "DJ mode is now **disabled**.",
    djmodeLabel: "DJ mode",
    djmodeActive: "DJ mode is active \u2014 only listeners in the voice channel can control me.",
    leftIdle: "Left the channel due to inactivity.",
    leftAlone: "Left the channel because everyone left.",
    notSeekable: "This track cannot be seeked.",
    queueEnded: "The queue has ended.",
    ctrlPrevious: "Previous",
    ctrlPause: "Pause",
    ctrlResume: "Resume",
    ctrlSkip: "Skip",
    ctrlLoop: "Loop",
    ctrlStop: "Stop",
    ctrlShuffle: "Shuffle",
    ctrlQueue: "Queue",
    ctrlLyrics: "Lyrics",
    ctrlVolDown: "Vol \u221210",
    ctrlVolUp: "Vol +10",
    engineNotReady: "The music engine is not connected yet \u2014 Lavalink is still starting or unreachable. Try again in a minute (check the bot console).",
    skiptoTitle: "Skipped to track",
    skiptoDone: "Jumped straight to position {index} \u2014 everything before it was dropped.",
    removedDuplicatesTitle: "Duplicates removed",
    removedDuplicates: "Removed **{count}** duplicate track(s) from the queue.",
    noDuplicates: "No duplicate tracks found \u2014 your queue is clean!",
    sleepTitle: "Sleep timer",
    sleepSet: "I'll pause playback in {minutes} minute(s).",
    sleepCancelled: "Sleep timer cancelled.",
    sleepStatus: "Playback pauses in {minutes} minute(s).",
    sleepNone: "No sleep timer is set. Use `sleep <minutes>` to schedule one."
  },
  playlists: {
    created: "Created playlist **{name}**.",
    createdTitle: "Playlist created",
    deleted: "Deleted playlist **{name}**.",
    deletedTitle: "Playlist deleted",
    renamed: "Renamed **{old}** to **{new}**.",
    renamedTitle: "Playlist renamed",
    notFound: "You do not have a playlist named **{name}**.",
    exists: "You already have a playlist named **{name}**.",
    nameTooLong: "Playlist names can be at most 64 characters.",
    addedTracks: "Added **{count}** tracks to **{name}**.",
    addedTitle: "Track added",
    addedCurrent: "Added **{title}** to **{name}**.",
    noCurrent: "Nothing is playing \u2014 provide a song name or URL.",
    removedTrack: "Removed **{title}** from **{name}**.",
    removedTrackTitle: "Track removed",
    listTitle: "Your playlists",
    listEmpty: "You have no playlists yet.",
    infoTitle: "Playlist: {name}",
    infoFooter: "{count} tracks \u2022 {duration} \u2022 {visibility}",
    public: "Public",
    private: "Private",
    visibilityTitle: "Visibility changed",
    loaded: "Loaded **{count}** tracks from **{name}**.",
    loadedTitle: "Playlist loaded",
    empty: "Playlist **{name}** is empty.",
    limitReached: "Playlists can hold at most {limit} tracks.",
    tooManyToAdd: "That would exceed the playlist limit of {limit} tracks.",
    favorites: "Favorites",
    favoritesEmpty: "You have no favorites yet.",
    favoritesAdded: "Added **{title}** to your favorites.",
    favoritesRemoved: "Removed **{title}** from your favorites.",
    favoritesLoaded: "Loaded **{count}** favorites.",
    owner: "Owner",
    savedQueueTitle: "Queue saved",
    savedQueue: "Saved the current queue ({count} tracks) to playlist **{name}**.",
    savedQueueUpdated: "Updated playlist **{name}** with the current queue ({count} tracks).",
    nothingToSave: "Nothing is playing \u2014 there is no queue to save."
  },
  filters: {
    applied: "Filter **{name}** applied.",
    appliedTitle: "Filter applied",
    removed: "Filter **{name}** removed.",
    removedTitle: "Filter removed",
    reset: "All filters have been reset.",
    resetTitle: "Filters reset",
    resetAll: "Reset all filters",
    openPanel: "Filter panel",
    panelTitle: "Audio filters",
    panelHint: "Pick a filter below to toggle it \u2014 changes apply instantly.",
    pickPlaceholder: "Toggle a filter\u2026",
    stateOn: "ON \u2014 select to disable",
    stateOff: "OFF \u2014 select to enable",
    listTitle: "Active filters",
    listNone: "No filters are active.",
    invalidLevel: "Level must be one of: low, medium, high, insane.",
    invalidValue: "Value must be between {min} and {max}.",
    eqApplied: "Custom equalizer applied.",
    eqUsage: "Usage: `{prefix}eq <15 gains from -1 to 1>` \u2014 e.g. `{prefix}eq 0.3 0.3 0.2 0 -0.2 0 0 0 0 0 0 0 0 0 0`"
  },
  settings: {
    "247": "Default 24/7",
    title: "Settings for {guild}",
    prefix: "Prefix",
    language: "Language",
    djRoles: "DJ roles",
    botChannels: "Allowed channels",
    defaultVolume: "Default volume",
    autoplay: "Default autoplay",
    idleTimeout: "Idle timeout",
    allChannels: "All channels",
    noTimeout: "Disabled",
    prefixSet: "Prefix set to `{prefix}`.",
    prefixInvalid: "The prefix must be 1-5 characters and cannot contain spaces.",
    languageSet: "Language set to **{language}**.",
    languageInvalid: "Available languages: {languages}.",
    djRoleAdded: "**{role}** is now a DJ role.",
    djRoleRemoved: "**{role}** is no longer a DJ role.",
    djRoleNotSet: "**{role}** is not a DJ role.",
    djRoleList: "DJ roles: {roles}",
    djRoleNone: "No DJ roles are set.",
    botChannelAdded: "Music commands are now restricted to **{channel}**.",
    botChannelRemoved: "**{channel}** was removed from the allowed channels.",
    botChannelNotSet: "**{channel}** is not in the allowed channels.",
    botChannelCleared: "Music commands are now allowed in all channels.",
    defaultVolumeSet: "Default volume set to **{level}%**.",
    idleTimeoutSet: "Idle timeout set to **{minutes}** minutes.",
    idleTimeoutDisabled: "Idle timeout disabled \u2014 I will stay until stopped."
  },
  info: {
    helpTitle: "Slux \u2014 Help",
    helpDescription: "A feature-rich music bot. Use slash commands or `{prefix}` as prefix.",
    helpPickCategory: "Choose a command category\u2026",
    helpCategoryCount: "{count} commands",
    helpAndMore: "+{count} more",
    helpCommandsTitle: "Commands",
    helpFields: {
      music: "Music",
      playlists: "Playlists",
      filters: "Filters",
      settings: "Settings",
      info: "Info"
    },
    helpFooter: "See all commands on the dashboard",
    pingTitle: "Pong!",
    pingStatus: "Gateway connection status",
    pingWebsocket: "Websocket",
    pingRoundtrip: "Roundtrip",
    pingLavalink: "Lavalink",
    statsTitle: "Slux \u2014 Statistics",
    statsServers: "Servers",
    statsPlayers: "Active players",
    statsUsers: "Users",
    statsUptime: "Uptime",
    statsMemory: "Memory",
    statsNode: "Lavalink node",
    statsNodePenalties: "Node penalties",
    inviteTitle: "Invite Slux",
    inviteDescription: "Click the button below to add Slux to your server.",
    inviteButton: "Invite Slux",
    dashboardButton: "Open dashboard",
    aboutTitle: "About Slux",
    aboutDescription: "Slux is a free, feature-rich Discord music bot with Spotify, YouTube, SoundCloud, Deezer, Apple Music and more \u2014 with a real-time web dashboard.",
    aboutSources: "Sources",
    aboutFeatures: "Highlights",
    aboutFooter: "Made with \u2665 \u2014 free forever, no premium tiers",
    nodesTitle: "Music nodes",
    nodesActive: "Active node: {name}",
    nodeConnected: "Connected",
    nodeConnecting: "Connecting\u2026",
    nodeDisconnecting: "Disconnecting\u2026",
    nodeDisconnected: "Offline",
    nodePlayers: "Players",
    nodeCpu: "CPU",
    developerTitle: "Made by SHM",
    developerDescription: "Slux is designed, built and maintained by **SHM**. Every feature \u2014 the player engine, filters, dashboard and lyrics \u2014 is crafted with love.",
    developerRole: "Creator & Developer",
    developerWorkTitle: "The work",
    developerWork: "Follow **@Letzforge** on YouTube for build videos, dev logs and tutorials on projects like this one.",
    developerFooter: "Made with \u2764\uFE0F by SHM"
  },
  dashboard: {
    nav: {
      player: "Player",
      settings: "Settings",
      playlists: "Playlists",
      backToSite: "Back to site",
      logout: "Log out",
      dashboard: "Dashboard",
      commands: "Commands",
      theme: "Theme"
    },
    landing: {
      badge: "Free forever \u2014 no premium tiers",
      title: "Music that never misses a beat",
      subtitle: "Slux is a feature-rich Discord music bot with Spotify, YouTube, SoundCloud, Deezer and Apple Music support \u2014 plus a real-time dashboard to control everything from your browser.",
      addDiscord: "Add to Discord",
      openDashboard: "Open Dashboard",
      featuresTitle: "Everything you need",
      featuresSubtitle: "All features, free for everyone. That is the Slux promise.",
      sourcesTitle: "All your sources",
      sourcesDescription: "Search and play from Spotify, YouTube, SoundCloud, Deezer, Apple Music, Tidal and YouTube Music.",
      filtersTitle: "Studio-grade filters",
      filtersDescription: "Bassboost, nightcore, vaporwave, 8D, karaoke and a full 15-band equalizer.",
      playlistsTitle: "Powerful playlists",
      playlistsDescription: "Save your favorite tracks, import playlists and load them in one command.",
      lyricsTitle: "Synced lyrics",
      lyricsDescription: "Follow along in Discord or on the dashboard with time-synced lyrics.",
      dashboardTitle: "Real-time dashboard",
      dashboardDescription: "Control playback, manage the queue and configure the bot from your browser.",
      autoplayTitle: "Autoplay & 24/7",
      autoplayDescription: "Slux keeps the music going with related tracks and can stay in voice all day.",
      i18nTitle: "Speaks your language",
      i18nDescription: "English, Hindi, Spanish, French, German and Portuguese out of the box.",
      statsServers: "servers",
      statsPlayers: "active players",
      statsTracks: "tracks played",
      ctaTitle: "Ready to upgrade your server's sound?",
      ctaSubtitle: "Add Slux in under a minute. No setup, no premium, no limits."
    },
    commands: {
      title: "Commands",
      subtitle: "Everything Slux can do \u2014 in {count} commands",
      search: "Search commands...",
      noResults: "No commands match your search.",
      usage: "Usage"
    },
    guilds: {
      title: "Your servers",
      subtitle: "Pick a server to manage",
      invite: "Invite",
      manage: "Manage",
      empty: "No servers with Manage Server permission found."
    },
    settings: {
      title: "Settings",
      general: "General",
      playback: "Playback",
      dj: "DJ",
      prefix: "Command prefix",
      prefixDescription: "Prefix for text commands",
      language: "Language",
      languageDescription: "Bot responses language",
      defaultVolume: "Default volume",
      defaultVolumeDescription: "Volume when the player starts",
      autoplay: "Autoplay",
      autoplayDescription: "Keep playing related tracks when the queue ends",
      stay247: "24/7 mode",
      stay247Description: "Stay in the voice channel when alone or idle",
      idleTimeout: "Idle timeout",
      idleTimeoutDescription: "Leave after this many minutes idle (0 = never)",
      djRoles: "DJ roles",
      djRolesDescription: "Roles that can use DJ commands",
      botChannels: "Allowed channels",
      botChannelsDescription: "Restrict music commands to these channels",
      allChannels: "All channels allowed",
      save: "Save changes",
      saved: "Settings saved",
      saveFailed: "Failed to save settings",
      notAvailable: "Server not available \u2014 is the bot in it?"
    },
    player: {
      title: "Player",
      notConnected: "Not connected",
      notConnectedDescription: "Slux is not in a voice channel. Pick a channel to start listening.",
      join: "Join channel",
      nowPlaying: "Now playing",
      nothingPlaying: "Nothing playing",
      queue: "Queue",
      queueEmpty: "The queue is empty \u2014 search for something!",
      lyrics: "Lyrics",
      noLyrics: "No lyrics available for this track.",
      lyricsSynced: "Synced",
      lyricsPlain: "Plain",
      autoScroll: "Auto-scroll",
      history: "History",
      historyEmpty: "Nothing in the history yet.",
      replay: "Play again",
      filtersTab: "Filters",
      filtersNone: "No filters are active.",
      filtersReset: "Reset filters",
      seekHint: "Drag to seek",
      searchPlaceholder: "Search or paste a link...",
      play: "Play",
      pause: "Pause",
      resume: "Resume",
      previous: "Previous",
      skip: "Skip",
      stop: "Stop",
      shuffle: "Shuffle",
      loop: "Loop",
      volume: "Volume",
      autoplay: "Autoplay",
      clear: "Clear queue",
      remove: "Remove",
      moveTop: "Move to top",
      added: "Added to the queue",
      live: "LIVE",
      requestedBy: "Requested by",
      playingIn: "Playing in",
      realtimeOff: "Realtime disconnected"
    },
    playlists: {
      title: "Your playlists",
      subtitle: "Your saved collections, available on any server",
      create: "New playlist",
      createTitle: "Create a playlist",
      namePlaceholder: "Playlist name",
      descriptionPlaceholder: "Description (optional)",
      createCta: "Create",
      delete: "Delete playlist",
      deleteConfirm: 'Delete playlist "{name}"? This cannot be undone.',
      public: "Public",
      private: "Private",
      tracks: "tracks",
      empty: "No playlists yet \u2014 create your first one!",
      loadToGuild: "Play in a server",
      removeTrack: "Remove track",
      created: "Playlist created",
      deleted: "Playlist deleted",
      emptyPlaylist: "This playlist is empty."
    },
    auth: {
      login: "Login with Discord",
      loginRequired: "Login required",
      loginRequiredDescription: "You need to log in with Discord to access the dashboard."
    },
    user: {
      loggedInAs: "Logged in as"
    }
  }
};

// src/i18n/locales/hi.json
var hi_default = {
  common: {
    error: "\u0915\u0941\u091B \u0917\u0932\u0924 \u0939\u094B \u0917\u092F\u093E\u0964 \u0915\u0943\u092A\u092F\u093E \u092B\u093F\u0930 \u0938\u0947 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964",
    noVoiceChannel: "\u092A\u0939\u0932\u0947 \u0906\u092A\u0915\u094B \u090F\u0915 \u0935\u0949\u0907\u0938 \u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0936\u093E\u092E\u093F\u0932 \u0939\u094B\u0928\u093E \u0939\u094B\u0917\u093E\u0964",
    noPlayer: "\u0905\u092D\u0940 \u0915\u0941\u091B \u092D\u0940 \u0928\u0939\u0940\u0902 \u092C\u091C \u0930\u0939\u093E \u0939\u0948\u0964",
    notInSameVoice: "\u0906\u092A\u0915\u094B \u092E\u0947\u0930\u0947 \u0938\u092E\u093E\u0928 \u0935\u0949\u0907\u0938 \u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F\u0964",
    queueEmpty: "\u0915\u094D\u092F\u0942 \u0916\u093E\u0932\u0940 \u0939\u0948\u0964",
    cancelled: "\u0930\u0926\u094D\u0926 \u0915\u0930 \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    timeUp: "\u0938\u092E\u092F \u0938\u092E\u093E\u092A\u094D\u0924 \u0939\u094B \u0917\u092F\u093E\u0964",
    djRequired: "\u0907\u0938 \u0915\u092E\u093E\u0902\u0921 \u0915\u0947 \u0932\u093F\u090F \u0906\u092A\u0915\u094B DJ \u0930\u094B\u0932 \u092F\u093E Manage Channels \u0905\u0928\u0941\u092E\u0924\u093F \u091A\u093E\u0939\u093F\u090F\u0964",
    manageGuildRequired: "\u0907\u0938 \u0915\u092E\u093E\u0902\u0921 \u0915\u0947 \u0932\u093F\u090F \u0906\u092A\u0915\u094B Manage Server \u0905\u0928\u0941\u092E\u0924\u093F \u091A\u093E\u0939\u093F\u090F\u0964",
    blacklisted: "\u0906\u092A \u0907\u0938 \u092C\u0949\u091F \u0915\u093E \u0909\u092A\u092F\u094B\u0917 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0905\u0927\u093F\u0915\u0943\u0924 \u0928\u0939\u0940\u0902 \u0939\u0948\u0902\u0964",
    nothingFound: "\u0907\u0938 \u0915\u094D\u0935\u0947\u0930\u0940 \u0915\u0947 \u0932\u093F\u090F \u0915\u0941\u091B \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E\u0964",
    invalidNumber: "\u0915\u0943\u092A\u092F\u093E \u090F\u0915 \u092E\u093E\u0928\u094D\u092F \u0938\u0902\u0916\u094D\u092F\u093E \u0926\u0947\u0902\u0964",
    page: "\u092A\u0943\u0937\u094D\u0920 {current}/{total}",
    requestedBy: "{user} \u0926\u094D\u0935\u093E\u0930\u093E \u0905\u0928\u0941\u0930\u094B\u0927\u093F\u0924",
    unknownCommand: "\u0905\u091C\u094D\u091E\u093E\u0924 \u0915\u092E\u093E\u0902\u0921\u0964 `{prefix}help` \u0906\u091C\u093C\u092E\u093E\u090F\u0901\u0964",
    yes: "\u0939\u093E\u0901",
    no: "\u0928\u0939\u0940\u0902",
    enabled: "\u0938\u0915\u094D\u0930\u093F\u092F",
    disabled: "\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F",
    none: "\u0915\u094B\u0908 \u0928\u0939\u0940\u0902",
    minutes: "\u092E\u093F\u0928\u091F",
    tracks: "\u091F\u094D\u0930\u0948\u0915",
    errorTitle: "\u0924\u094D\u0930\u0941\u091F\u093F",
    doneTitle: "\u092A\u0942\u0930\u094D\u0923",
    warnTitle: "\u0927\u094D\u092F\u093E\u0928 \u0926\u0947\u0902",
    on: "\u091A\u093E\u0932\u0942",
    off: "\u092C\u0902\u0926",
    commands: "\u0915\u092E\u093E\u0902\u0921",
    viewExpired: "\u092F\u0939 \u0935\u094D\u092F\u0942 \u0938\u092E\u093E\u092A\u094D\u0924 \u0939\u094B \u0917\u092F\u093E \u0939\u0948 \u2014 \u0915\u092E\u093E\u0902\u0921 \u092B\u093F\u0930 \u0938\u0947 \u091A\u0932\u093E\u090F\u0901\u0964",
    cooldown: "\u0906\u092A \u092C\u0939\u0941\u0924 \u0924\u0947\u091C\u093C\u0940 \u0938\u0947 \u0915\u092E\u093E\u0902\u0921 \u091A\u0932\u093E \u0930\u0939\u0947 \u0939\u0948\u0902 \u2014 \u0915\u0941\u091B \u0938\u0947\u0915\u0902\u0921 \u092E\u0947\u0902 \u092B\u093F\u0930 \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964",
    channelNotAllowed: "\u0907\u0938 \u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0915\u092E\u093E\u0902\u0921 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    mentionHelp: {
      title: "\u0928\u092E\u0938\u094D\u0924\u0947, \u092E\u0948\u0902 Slux \u0939\u0942\u0901!",
      description: "\u0906\u092A\u0915\u0947 \u0938\u0930\u094D\u0935\u0930 \u0915\u093E \u092E\u094D\u092F\u0942\u091C\u093C\u093F\u0915 \u092C\u0949\u091F \u2014 \u0938\u0930\u094D\u091A, \u0915\u094D\u092F\u0942, \u092C\u094B\u0932, \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0914\u0930 \u0932\u093E\u0907\u0935 \u0935\u0947\u092C \u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921\u0964 \u092E\u0941\u091D\u0947 \u0910\u0938\u0947 \u0907\u0938\u094D\u0924\u0947\u092E\u093E\u0932 \u0915\u0930\u0947\u0902:",
      prefixField: "\u092F\u0939\u093E\u0901 \u0915\u093E \u092A\u094D\u0930\u0940\u092B\u093C\u093F\u0915\u094D\u0938",
      prefixValue: "\u0915\u092E\u093E\u0902\u0921 \u0938\u0947 \u092A\u0939\u0932\u0947 {prefix} \u0932\u0917\u093E\u090F\u0901, \u091C\u0948\u0938\u0947 {prefix}play",
      slashField: "\u0938\u094D\u0932\u0948\u0936 \u0915\u092E\u093E\u0902\u0921",
      slashValue: "\u0915\u0939\u0940\u0902 \u092D\u0940 `/` \u091F\u093E\u0907\u092A \u0915\u0930\u0947\u0902 \u0914\u0930 \u0915\u092E\u093E\u0902\u0921 \u091A\u0941\u0928\u0947\u0902\u0964",
      popularField: "\u0932\u094B\u0915\u092A\u094D\u0930\u093F\u092F \u0915\u092E\u093E\u0902\u0921",
      tipField: "\u0938\u0941\u091D\u093E\u0935",
      tipValue: "\u092F\u0939 \u0938\u0902\u0926\u0947\u0936 \u0926\u0947\u0916\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u092E\u0941\u091D\u0947 \u0915\u092D\u0940 \u092D\u0940 \u092E\u0947\u0902\u0936\u0928 \u0915\u0930\u0947\u0902, \u092F\u093E \u092A\u0942\u0930\u0940 \u0938\u0942\u091A\u0940 \u0915\u0947 \u0932\u093F\u090F {prefix}help \u091A\u0932\u093E\u090F\u0901\u0964",
      commandsButton: "\u0938\u092D\u0940 \u0915\u092E\u093E\u0902\u0921",
      dashboardButton: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921",
      inviteButton: "\u092E\u0941\u091D\u0947 \u0907\u0928\u0935\u093E\u0907\u091F \u0915\u0930\u0947\u0902"
    }
  },
  commands: {
    "247": {
      name: "247",
      description: "24/7 \u0935\u0949\u0907\u0938 \u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0930\u0939\u0928\u093E \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    play: {
      name: "play",
      description: "\u090F\u0915 \u0917\u093E\u0928\u093E, \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u092F\u093E \u0916\u094B\u091C \u092C\u091C\u093E\u090F\u0901",
      options: {
        query: "\u0917\u093E\u0928\u0947 \u0915\u093E \u0928\u093E\u092E, URL \u092F\u093E \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0932\u093F\u0902\u0915"
      }
    },
    playnext: {
      name: "playnext",
      description: "\u0917\u093E\u0928\u093E \u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u0947 \u0915\u0947 \u0924\u0941\u0930\u0902\u0924 \u092C\u093E\u0926 \u091C\u094B\u0921\u093C\u0947\u0902",
      options: {
        query: "\u0917\u093E\u0928\u0947 \u0915\u093E \u0928\u093E\u092E \u092F\u093E URL"
      }
    },
    playtop: {
      name: "playtop",
      description: "\u0917\u093E\u0928\u093E \u0915\u094D\u092F\u0942 \u0915\u0947 \u0938\u092C\u0938\u0947 \u090A\u092A\u0930 \u091C\u094B\u0921\u093C\u0947\u0902",
      options: {
        query: "\u0917\u093E\u0928\u0947 \u0915\u093E \u0928\u093E\u092E \u092F\u093E URL"
      }
    },
    playskip: {
      name: "playskip",
      description: "\u0917\u093E\u0928\u093E \u0938\u092C\u0938\u0947 \u090A\u092A\u0930 \u091C\u094B\u0921\u093C\u0947\u0902 \u0914\u0930 \u0924\u0941\u0930\u0902\u0924 \u0909\u0938 \u092A\u0930 \u091C\u093E\u090F\u0901",
      options: {
        query: "\u0917\u093E\u0928\u0947 \u0915\u093E \u0928\u093E\u092E \u092F\u093E URL"
      }
    },
    pause: {
      name: "pause",
      description: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u093E \u0930\u094B\u0915\u0947\u0902"
    },
    resume: {
      name: "resume",
      description: "\u0930\u0941\u0915\u0947 \u0939\u0941\u090F \u0917\u093E\u0928\u0947 \u0915\u094B \u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902"
    },
    stop: {
      name: "stop",
      description: "\u092C\u091C\u093E\u0928\u093E \u092C\u0902\u0926 \u0915\u0930\u0947\u0902, \u0915\u094D\u092F\u0942 \u0938\u093E\u092B\u093C \u0915\u0930\u0947\u0902 \u0914\u0930 \u091A\u0932\u0947 \u091C\u093E\u090F\u0901"
    },
    skip: {
      name: "skip",
      description: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u093E \u091B\u094B\u0921\u093C \u0926\u0947\u0902"
    },
    previous: {
      name: "previous",
      description: "\u0907\u0924\u093F\u0939\u093E\u0938 \u0938\u0947 \u092A\u093F\u091B\u0932\u093E \u0917\u093E\u0928\u093E \u092C\u091C\u093E\u090F\u0901"
    },
    seek: {
      name: "seek",
      description: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u0947 \u092E\u0947\u0902 \u090F\u0915 \u0938\u094D\u0925\u093F\u0924\u093F \u092A\u0930 \u091C\u093E\u090F\u0901",
      options: {
        position: "1:30, 90, \u092F\u093E 1m30s \u091C\u0948\u0938\u0940 \u0938\u094D\u0925\u093F\u0924\u093F"
      }
    },
    forward: {
      name: "forward",
      description: "\u0915\u0941\u091B \u0938\u0947\u0915\u0902\u0921 \u0906\u0917\u0947 \u092C\u0922\u093C\u0947\u0902",
      options: {
        seconds: "\u0906\u0917\u0947 \u092C\u0922\u093C\u0928\u0947 \u0915\u0947 \u0938\u0947\u0915\u0902\u0921"
      }
    },
    rewind: {
      name: "rewind",
      description: "\u0915\u0941\u091B \u0938\u0947\u0915\u0902\u0921 \u092A\u0940\u091B\u0947 \u091C\u093E\u090F\u0901",
      options: {
        seconds: "\u092A\u0940\u091B\u0947 \u091C\u093E\u0928\u0947 \u0915\u0947 \u0938\u0947\u0915\u0902\u0921"
      }
    },
    queue: {
      name: "queue",
      description: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0915\u094D\u092F\u0942 \u0926\u093F\u0916\u093E\u090F\u0901",
      options: {
        page: "\u092A\u0943\u0937\u094D\u0920 \u0938\u0902\u0916\u094D\u092F\u093E"
      }
    },
    nowplaying: {
      name: "nowplaying",
      description: "\u0905\u092D\u0940 \u091C\u094B \u0917\u093E\u0928\u093E \u092C\u091C \u0930\u0939\u093E \u0939\u0948 \u0909\u0938\u0947 \u0926\u093F\u0916\u093E\u090F\u0901"
    },
    remove: {
      name: "remove",
      description: "\u0915\u094D\u092F\u0942 \u0938\u0947 \u090F\u0915 \u0917\u093E\u0928\u093E \u0939\u091F\u093E\u090F\u0901",
      options: {
        index: "\u0939\u091F\u093E\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u094D\u092F\u0942 \u0938\u094D\u0925\u093F\u0924\u093F"
      }
    },
    clear: {
      name: "clear",
      description: "\u092A\u0942\u0930\u0940 \u0915\u094D\u092F\u0942 \u0938\u093E\u092B\u093C \u0915\u0930\u0947\u0902"
    },
    move: {
      name: "move",
      description: "\u0915\u094D\u092F\u0942 \u092E\u0947\u0902 \u090F\u0915 \u0917\u093E\u0928\u093E \u0938\u094D\u0925\u093E\u0928\u093E\u0902\u0924\u0930\u093F\u0924 \u0915\u0930\u0947\u0902",
      options: {
        from: "\u0915\u0939\u093E\u0901 \u0938\u0947",
        to: "\u0915\u0939\u093E\u0901 \u0924\u0915"
      }
    },
    shuffle: {
      name: "shuffle",
      description: "\u0915\u094D\u092F\u0942 \u0915\u094B \u0936\u092B\u093C\u0932 \u0915\u0930\u0947\u0902"
    },
    loop: {
      name: "loop",
      description: "\u0932\u0942\u092A \u092E\u094B\u0921 \u0938\u0947\u091F \u0915\u0930\u0947\u0902",
      options: {
        mode: "\u0932\u0942\u092A \u092E\u094B\u0921: off, track, \u092F\u093E queue"
      }
    },
    volume: {
      name: "volume",
      description: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E \u0938\u0947\u091F \u0915\u0930\u0947\u0902 \u092F\u093E \u0926\u0947\u0916\u0947\u0902",
      options: {
        level: "0 \u0938\u0947 150 \u0924\u0915 \u0935\u0949\u0932\u094D\u092F\u0942\u092E"
      }
    },
    join: {
      name: "join",
      description: "\u0906\u092A\u0915\u0947 \u0935\u0949\u0907\u0938 \u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0936\u093E\u092E\u093F\u0932 \u0939\u094B\u0902"
    },
    replay: {
      name: "replay",
      description: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u093E \u0936\u0941\u0930\u0942 \u0938\u0947 \u092C\u091C\u093E\u090F\u0901"
    },
    grab: {
      name: "grab",
      description: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u093E DM \u092E\u0947\u0902 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0915\u0930\u0947\u0902"
    },
    search: {
      name: "search",
      description: "\u0917\u093E\u0928\u0947 \u0916\u094B\u091C\u0947\u0902 \u0914\u0930 \u090F\u0915 \u091A\u0941\u0928\u0947\u0902",
      options: {
        query: "\u0915\u094D\u092F\u093E \u0916\u094B\u091C\u0928\u093E \u0939\u0948"
      }
    },
    lyrics: {
      name: "lyrics",
      description: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u0947 \u0915\u0947 \u092C\u094B\u0932 \u0926\u093F\u0916\u093E\u090F\u0901"
    },
    autoplay: {
      name: "autoplay",
      description: "\u0938\u0902\u092C\u0902\u0927\u093F\u0924 \u0917\u093E\u0928\u094B\u0902 \u0915\u093E \u0911\u091F\u094B\u092A\u094D\u0932\u0947 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    djmode: {
      name: "djmode",
      description: "DJ \u092E\u094B\u0921 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902: \u0915\u0947\u0935\u0932 \u0935\u0949\u0907\u0938 \u0938\u0926\u0938\u094D\u092F \u092C\u0949\u091F \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902"
    },
    playlist: {
      name: "playlist",
      description: "\u0905\u092A\u0928\u0940 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u092A\u094D\u0930\u092C\u0902\u0927\u093F\u0924 \u0915\u0930\u0947\u0902",
      subcommands: {
        create: {
          description: "\u0928\u0908 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u092C\u0928\u093E\u090F\u0901",
          options: {
            name: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E"
          }
        },
        delete: {
          description: "\u0905\u092A\u0928\u0940 \u090F\u0915 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0939\u091F\u093E\u090F\u0901",
          options: {
            name: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E"
          }
        },
        rename: {
          description: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E \u092C\u0926\u0932\u0947\u0902",
          options: {
            old: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0928\u093E\u092E",
            new: "\u0928\u092F\u093E \u0928\u093E\u092E"
          }
        },
        add: {
          description: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u092E\u0947\u0902 \u0917\u093E\u0928\u093E \u092F\u093E \u0932\u093F\u0902\u0915 \u091C\u094B\u0921\u093C\u0947\u0902",
          options: {
            name: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E",
            query: "\u0917\u093E\u0928\u093E \u092F\u093E URL"
          }
        },
        remove: {
          description: "\u0938\u094D\u0925\u093F\u0924\u093F \u0938\u0947 \u091F\u094D\u0930\u0948\u0915 \u0939\u091F\u093E\u090F\u0901",
          options: {
            name: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E",
            index: "\u091F\u094D\u0930\u0948\u0915 \u0938\u094D\u0925\u093F\u0924\u093F"
          }
        },
        list: {
          description: "\u0905\u092A\u0928\u0940 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0926\u093F\u0916\u093E\u090F\u0901"
        },
        info: {
          description: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u0947 \u091F\u094D\u0930\u0948\u0915 \u0926\u093F\u0916\u093E\u090F\u0901",
          options: {
            name: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E"
          }
        },
        load: {
          description: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u094D\u092F\u0942 \u092E\u0947\u0902 \u0932\u094B\u0921 \u0915\u0930\u0947\u0902",
          options: {
            name: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E"
          }
        },
        public: {
          description: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0938\u093E\u0930\u094D\u0935\u091C\u0928\u093F\u0915/\u0928\u093F\u091C\u0940 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902",
          options: {
            name: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E"
          }
        },
        save: {
          description: "\u092E\u094C\u091C\u0942\u0926\u093E \u0915\u094D\u092F\u0942 \u0915\u094B \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u0947 \u0930\u0942\u092A \u092E\u0947\u0902 \u0938\u0947\u0935 \u0915\u0930\u0947\u0902",
          options: {
            name: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E"
          }
        }
      }
    },
    favorites: {
      name: "favorites",
      description: "\u0905\u092A\u0928\u0947 \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u0917\u093E\u0928\u0947 \u092A\u094D\u0930\u092C\u0902\u0927\u093F\u0924 \u0915\u0930\u0947\u0902",
      subcommands: {
        add: {
          description: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u093E \u092F\u093E \u0915\u094D\u0935\u0947\u0930\u0940 \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u0947\u0902",
          options: {
            query: "\u0917\u093E\u0928\u0947 \u0915\u093E \u0928\u093E\u092E \u092F\u093E URL (\u0916\u093E\u0932\u0940 = \u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u093E)"
          }
        },
        remove: {
          description: "\u0938\u094D\u0925\u093F\u0924\u093F \u0938\u0947 \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u0939\u091F\u093E\u090F\u0901",
          options: {
            index: "\u092A\u0938\u0902\u0926\u0940\u0926\u093E \u0938\u094D\u0925\u093F\u0924\u093F"
          }
        },
        list: {
          description: "\u0905\u092A\u0928\u0947 \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u0926\u093F\u0916\u093E\u090F\u0901"
        },
        play: {
          description: "\u0905\u092A\u0928\u0947 \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u092C\u091C\u093E\u090F\u0901"
        }
      }
    },
    bassboost: {
      name: "bassboost",
      description: "bassboost \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902",
      options: {
        level: "\u0938\u094D\u0924\u0930: low, medium, high, \u092F\u093E insane"
      }
    },
    nightcore: {
      name: "nightcore",
      description: "nightcore \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    vaporwave: {
      name: "vaporwave",
      description: "vaporwave \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    soft: {
      name: "soft",
      description: "soft \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    "8d": {
      name: "8d",
      description: "8D \u0911\u0921\u093F\u092F\u094B \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    karaoke: {
      name: "karaoke",
      description: "karaoke \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    tremolo: {
      name: "tremolo",
      description: "tremolo \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    vibrato: {
      name: "vibrato",
      description: "vibrato \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    distortion: {
      name: "distortion",
      description: "distortion \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    lowpass: {
      name: "lowpass",
      description: "lowpass \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902"
    },
    speed: {
      name: "speed",
      description: "\u092A\u094D\u0932\u0947\u092C\u0948\u0915 \u0917\u0924\u093F \u0938\u0947\u091F \u0915\u0930\u0947\u0902",
      options: {
        value: "0.5 \u0938\u0947 5.0 \u0924\u0915 \u0917\u0924\u093F"
      }
    },
    pitch: {
      name: "pitch",
      description: "\u092A\u093F\u091A \u0938\u0947\u091F \u0915\u0930\u0947\u0902",
      options: {
        value: "0.5 \u0938\u0947 5.0 \u0924\u0915 \u092A\u093F\u091A"
      }
    },
    eq: {
      name: "eq",
      description: "3 0 0 1 0 -1 \u091C\u0948\u0938\u093E \u0915\u0938\u094D\u091F\u092E \u0907\u0915\u094D\u0935\u0932\u093E\u0907\u091C\u093C\u0930 \u0938\u0947\u091F \u0915\u0930\u0947\u0902",
      options: {
        bands: "-1 \u0938\u0947 1 \u0924\u0915 15 \u0917\u0947\u0928"
      }
    },
    filters: {
      name: "filters",
      description: "\u0938\u0915\u094D\u0930\u093F\u092F \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0926\u093F\u0916\u093E\u090F\u0901"
    },
    filtersreset: {
      name: "reset",
      description: "\u0938\u092D\u0940 \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0930\u0940\u0938\u0947\u091F \u0915\u0930\u0947\u0902"
    },
    settings: {
      name: "settings",
      description: "\u0938\u0930\u094D\u0935\u0930 \u0938\u0947\u091F\u093F\u0902\u0917 \u0926\u093F\u0916\u093E\u090F\u0901"
    },
    prefix: {
      name: "prefix",
      description: "\u0907\u0938 \u0938\u0930\u094D\u0935\u0930 \u0915\u0947 \u0932\u093F\u090F \u0915\u092E\u093E\u0902\u0921 \u092A\u094D\u0930\u0940\u092B\u093C\u093F\u0915\u094D\u0938 \u0938\u0947\u091F \u0915\u0930\u0947\u0902",
      options: {
        prefix: "\u0928\u092F\u093E \u092A\u094D\u0930\u0940\u092B\u093C\u093F\u0915\u094D\u0938, \u0905\u0927\u093F\u0915\u0924\u092E 5 \u0905\u0915\u094D\u0937\u0930"
      }
    },
    language: {
      name: "language",
      description: "\u0907\u0938 \u0938\u0930\u094D\u0935\u0930 \u0915\u0947 \u0932\u093F\u090F \u092C\u0949\u091F \u092D\u093E\u0937\u093E \u0938\u0947\u091F \u0915\u0930\u0947\u0902",
      options: {
        language: "\u0909\u092A\u092F\u094B\u0917 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u092D\u093E\u0937\u093E"
      }
    },
    djrole: {
      name: "djrole",
      description: "DJ \u0930\u094B\u0932 \u092A\u094D\u0930\u092C\u0902\u0927\u093F\u0924 \u0915\u0930\u0947\u0902",
      subcommands: {
        add: {
          description: "DJ \u0930\u094B\u0932 \u091C\u094B\u0921\u093C\u0947\u0902",
          options: {
            role: "\u0930\u094B\u0932"
          }
        },
        remove: {
          description: "DJ \u0930\u094B\u0932 \u0939\u091F\u093E\u090F\u0901",
          options: {
            role: "\u0930\u094B\u0932"
          }
        },
        list: {
          description: "DJ \u0930\u094B\u0932 \u0926\u093F\u0916\u093E\u090F\u0901"
        }
      }
    },
    botchannel: {
      name: "botchannel",
      description: "\u0938\u0902\u0917\u0940\u0924 \u0915\u092E\u093E\u0902\u0921 \u0935\u093F\u0936\u093F\u0937\u094D\u091F \u091A\u0948\u0928\u0932\u094B\u0902 \u0924\u0915 \u0938\u0940\u092E\u093F\u0924 \u0915\u0930\u0947\u0902",
      subcommands: {
        add: {
          description: "\u091A\u0948\u0928\u0932 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0926\u0947\u0902",
          options: {
            channel: "\u091A\u0948\u0928\u0932"
          }
        },
        remove: {
          description: "\u091A\u0948\u0928\u0932 \u0905\u0938\u094D\u0935\u0940\u0915\u093E\u0930\u0947\u0902",
          options: {
            channel: "\u091A\u0948\u0928\u0932"
          }
        },
        clear: {
          description: "\u0938\u092D\u0940 \u091A\u0948\u0928\u0932\u094B\u0902 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0926\u0947\u0902"
        }
      }
    },
    defaultvolume: {
      name: "defaultvolume",
      description: "\u0907\u0938 \u0938\u0930\u094D\u0935\u0930 \u0915\u0947 \u0932\u093F\u090F \u0921\u093F\u092B\u093C\u0949\u0932\u094D\u091F \u0935\u0949\u0932\u094D\u092F\u0942\u092E \u0938\u0947\u091F \u0915\u0930\u0947\u0902",
      options: {
        level: "0 \u0938\u0947 150 \u0924\u0915 \u0935\u0949\u0932\u094D\u092F\u0942\u092E"
      }
    },
    idletimeout: {
      name: "idletimeout",
      description: "\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F \u0939\u094B\u0928\u0947 \u092A\u0930 \u091C\u093E\u0928\u0947 \u0938\u0947 \u092A\u0939\u0932\u0947 \u0915\u093F\u0924\u0928\u093E \u092A\u094D\u0930\u0924\u0940\u0915\u094D\u0937\u093E \u0915\u0930\u0947\u0902 \u0938\u0947\u091F \u0915\u0930\u0947\u0902",
      options: {
        minutes: "\u092E\u093F\u0928\u091F, \u0905\u0915\u094D\u0937\u092E \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F 0"
      }
    },
    help: {
      name: "help",
      description: "\u0938\u0939\u093E\u092F\u0924\u093E \u092E\u0947\u0928\u0942 \u0926\u093F\u0916\u093E\u090F\u0901"
    },
    ping: {
      name: "ping",
      description: "\u092C\u0949\u091F \u0935\u093F\u0932\u0902\u092C\u0924\u093E \u0926\u093F\u0916\u093E\u090F\u0901"
    },
    stats: {
      name: "stats",
      description: "\u092C\u0949\u091F \u0938\u093E\u0902\u0916\u094D\u092F\u093F\u0915\u0940 \u0926\u093F\u0916\u093E\u090F\u0901"
    },
    invite: {
      name: "invite",
      description: "\u092C\u0949\u091F \u0906\u092E\u0902\u0924\u094D\u0930\u0923 \u0932\u093F\u0902\u0915 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0915\u0930\u0947\u0902"
    },
    about: {
      name: "about",
      description: "Slux \u0915\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0926\u093F\u0916\u093E\u090F\u0901"
    },
    skipto: {
      description: "\u0915\u094D\u092F\u0942 \u092E\u0947\u0902 \u0915\u093F\u0938\u0940 \u0916\u093E\u0938 \u091F\u094D\u0930\u0948\u0915 \u092A\u0930 \u0938\u0940\u0927\u0947 \u091C\u093E\u090F\u0901",
      options: {
        index: "\u091C\u093F\u0938 \u0938\u094D\u0925\u093E\u0928 \u092A\u0930 \u091C\u093E\u0928\u093E \u0939\u0948"
      }
    },
    removeduplicates: {
      description: "\u0915\u094D\u092F\u0942 \u0938\u0947 \u0921\u0941\u092A\u094D\u0932\u093F\u0915\u0947\u091F \u091F\u094D\u0930\u0948\u0915 \u0939\u091F\u093E\u090F\u0901"
    },
    sleep: {
      description: "\u0928\u093F\u0930\u094D\u0927\u093E\u0930\u093F\u0924 \u0938\u092E\u092F \u092C\u093E\u0926 \u092A\u094D\u0932\u0947\u092C\u0948\u0915 \u0930\u094B\u0915\u0947\u0902 (\u0938\u094D\u0932\u0940\u092A \u091F\u093E\u0907\u092E\u0930)",
      options: {
        minutes: "\u0915\u093F\u0924\u0928\u0947 \u092E\u093F\u0928\u091F \u092C\u093E\u0926 \u0930\u094B\u0915\u0928\u093E \u0939\u0948 (\u0930\u0926\u094D\u0926 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F 0 \u092F\u093E off)"
      }
    },
    nodes: {
      description: "\u092E\u094D\u092F\u0942\u091C\u093C\u093F\u0915 \u0928\u094B\u0921\u094D\u0938 \u0915\u0940 \u0938\u094D\u0925\u093F\u0924\u093F \u0926\u093F\u0916\u093E\u090F\u0901"
    },
    developer: {
      description: "Slux \u0915\u0947 \u0921\u0947\u0935\u0932\u092A\u0930 \u0938\u0947 \u092E\u093F\u0932\u0947\u0902"
    }
  },
  music: {
    nowPlaying: "\u0905\u092C \u092C\u091C \u0930\u0939\u093E \u0939\u0948",
    searching: "\u0916\u094B\u091C \u0930\u0939\u0947 \u0939\u0948\u0902...",
    added: "**{title}** \u0915\u094D\u092F\u0942 \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E",
    addedAt: "**{title}** \u0915\u094D\u092F\u0942 \u0915\u0940 \u0938\u094D\u0925\u093F\u0924\u093F #{position} \u092A\u0930 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E",
    addedPlaylist: "**{name}** \u0938\u0947 **{count}** \u091F\u094D\u0930\u0948\u0915 \u0915\u094D\u092F\u0942 \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u0947 \u0917\u090F",
    selectPrompt: "\u090F\u0915 \u091F\u094D\u0930\u0948\u0915 \u091A\u0941\u0928\u0947\u0902 \u2014 `{query}` \u0915\u0947 \u092A\u0930\u093F\u0923\u093E\u092E",
    selectButton: "\u091A\u0941\u0928\u0947\u0902",
    cancelButton: "\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902",
    paused: "\u092A\u094D\u0932\u0947\u092F\u0930 \u0930\u094B\u0915 \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    resumed: "\u092A\u094D\u0932\u0947\u092F\u0930 \u091C\u093E\u0930\u0940 \u0930\u0916\u093E \u0917\u092F\u093E\u0964",
    alreadyPaused: "\u092A\u094D\u0932\u0947\u092F\u0930 \u092A\u0939\u0932\u0947 \u0938\u0947 \u0930\u0941\u0915\u093E \u0939\u0941\u0906 \u0939\u0948\u0964",
    notPaused: "\u092A\u094D\u0932\u0947\u092F\u0930 \u0930\u0941\u0915\u093E \u0939\u0941\u0906 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    stopped: "\u092A\u094D\u0932\u0947\u092F\u0930 \u092C\u0902\u0926 \u0915\u0930 \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u0914\u0930 \u091A\u0948\u0928\u0932 \u091B\u094B\u0921\u093C \u0926\u093F\u092F\u093E\u0964",
    skipped: "**{title}** \u091B\u094B\u0921\u093C \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    noPrevious: "\u0915\u094B\u0908 \u092A\u093F\u091B\u0932\u093E \u0917\u093E\u0928\u093E \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    previousNow: "\u0905\u092C \u092A\u093F\u091B\u0932\u093E \u0917\u093E\u0928\u093E \u092C\u091C \u0930\u0939\u093E \u0939\u0948\u0964",
    queueTitle: "{guild} \u0915\u0940 \u0915\u094D\u092F\u0942",
    queueNowPlaying: "**\u0905\u092C \u092C\u091C \u0930\u0939\u093E \u0939\u0948** \u2014 [{title}]({uri}) `{duration}`",
    queueUpNext: "\u0906\u0917\u0947 \u0906\u0928\u0947 \u0935\u093E\u0932\u093E",
    queueFooter: "{count} \u091F\u094D\u0930\u0948\u0915 \u2022 \u0915\u0941\u0932 {duration}",
    npLength: "\u0905\u0935\u0927\u093F",
    npPosition: "\u0938\u094D\u0925\u093F\u0924\u093F",
    npVolume: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E",
    npLoop: "\u0932\u0942\u092A",
    npFilters: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930",
    live: "\u0932\u093E\u0907\u0935",
    stream: "\u0932\u093E\u0907\u0935 \u0938\u094D\u091F\u094D\u0930\u0940\u092E",
    removed: "**{title}** \u0915\u094D\u092F\u0942 \u0938\u0947 \u0939\u091F\u093E \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    invalidIndex: "\u0938\u094D\u0925\u093F\u0924\u093F #{index} \u092A\u0930 \u0915\u094B\u0908 \u091F\u094D\u0930\u0948\u0915 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    cleared: "\u0915\u094D\u092F\u0942 \u0938\u093E\u092B\u093C \u0915\u0930 \u0926\u0940 \u0917\u0908 ({count} \u091F\u094D\u0930\u0948\u0915)\u0964",
    moved: "**{title}** \u0915\u094B #{from} \u0938\u0947 #{to} \u092A\u0930 \u0938\u094D\u0925\u093E\u0928\u093E\u0902\u0924\u0930\u093F\u0924 \u0915\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    shuffled: "\u0915\u094D\u092F\u0942 \u0936\u092B\u093C\u0932 \u0915\u0930 \u0926\u0940 \u0917\u0908 ({count} \u091F\u094D\u0930\u0948\u0915)\u0964",
    loopOff: "\u0932\u0942\u092A \u0905\u092C **\u092C\u0902\u0926** \u0939\u0948\u0964",
    loopTrack: "\u0905\u092C **\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u091F\u094D\u0930\u0948\u0915** \u0932\u0942\u092A \u0939\u094B \u0930\u0939\u093E \u0939\u0948\u0964",
    loopQueue: "\u0905\u092C **\u0915\u094D\u092F\u0942** \u0932\u0942\u092A \u0939\u094B \u0930\u0939\u0940 \u0939\u0948\u0964",
    volumeSet: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E **{level}%** \u092A\u0930 \u0938\u0947\u091F\u0964",
    volumeCurrent: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E \u0905\u092D\u0940 **{level}%** \u0939\u0948\u0964",
    seeked: "**{position}** \u092A\u0930 \u091C\u093E\u092F\u093E \u0917\u092F\u093E\u0964",
    seekInvalid: "\u0905\u092E\u093E\u0928\u094D\u092F \u0938\u094D\u0925\u093F\u0924\u093F \u2014 \u0917\u093E\u0928\u093E \u0915\u0947\u0935\u0932 {length} \u0932\u0902\u092C\u093E \u0939\u0948\u0964",
    forwarded: "**{position}** \u092A\u0930 \u0906\u0917\u0947 \u092C\u0922\u093C\u0947\u0964",
    rewound: "**{position}** \u092A\u0930 \u092A\u0940\u091B\u0947 \u0917\u090F\u0964",
    joined: "**{channel}** \u092E\u0947\u0902 \u0936\u093E\u092E\u093F\u0932 \u0939\u0941\u090F\u0964",
    joinFailed: "\u092E\u0948\u0902 \u0909\u0938 \u0935\u0949\u0907\u0938 \u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0936\u093E\u092E\u093F\u0932 \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u093E\u0964",
    replaying: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u093E \u092B\u093F\u0930 \u0938\u0947 \u092C\u091C \u0930\u0939\u093E \u0939\u0948\u0964",
    grabTitle: "\u0917\u093E\u0928\u093E \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0915\u093F\u092F\u093E",
    grabDmed: "\u092E\u0948\u0902\u0928\u0947 \u0906\u092A\u0915\u094B \u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u093E DM \u092E\u0947\u0902 \u092D\u0947\u091C \u0926\u093F\u092F\u093E\u0964",
    grabDmFailed: "\u092E\u0948\u0902 \u0906\u092A\u0915\u094B DM \u0928\u0939\u0940\u0902 \u0915\u0930 \u0938\u0915\u093E \u2014 \u0915\u0943\u092A\u092F\u093E \u0938\u0930\u094D\u0935\u0930 \u0938\u0926\u0938\u094D\u092F\u094B\u0902 \u0938\u0947 DM \u0938\u0915\u094D\u0937\u092E \u0915\u0930\u0947\u0902\u0964",
    lyricsTitle: "{title} \u0915\u0947 \u092C\u094B\u0932",
    lyricsNone: "\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0917\u093E\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u094B\u0908 \u092C\u094B\u0932 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u0947\u0964",
    autoplayOn: "\u0911\u091F\u094B\u092A\u094D\u0932\u0947 \u0905\u092C **\u0938\u0915\u094D\u0930\u093F\u092F** \u0939\u0948 \u2014 \u092E\u0948\u0902 \u0938\u0902\u092C\u0902\u0927\u093F\u0924 \u0917\u093E\u0928\u0947 \u092C\u091C\u093E\u0924\u093E \u0930\u0939\u0942\u0901\u0917\u093E\u0964",
    autoplayOff: "\u0911\u091F\u094B\u092A\u094D\u0932\u0947 \u0905\u092C **\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F** \u0939\u0948\u0964",
    stayOn: "24/7 \u092E\u094B\u0921 \u0905\u092C **\u0938\u0915\u094D\u0930\u093F\u092F** \u0939\u0948 \u2014 \u092E\u0948\u0902 \u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0930\u0939\u0942\u0901\u0917\u093E\u0964",
    stayOff: "24/7 \u092E\u094B\u0921 \u0905\u092C **\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F** \u0939\u0948\u0964",
    djmodeOn: "DJ \u092E\u094B\u0921 \u0905\u092C **\u0938\u0915\u094D\u0930\u093F\u092F** \u0939\u0948 \u2014 \u0915\u0947\u0935\u0932 \u0935\u0949\u0907\u0938 \u091A\u0948\u0928\u0932 \u0915\u0947 \u0936\u094D\u0930\u094B\u0924\u093E \u092E\u0941\u091D\u0947 \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964",
    djmodeOff: "DJ \u092E\u094B\u0921 \u0905\u092C **\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F** \u0939\u0948\u0964",
    djmodeActive: "DJ \u092E\u094B\u0921 \u0938\u0915\u094D\u0930\u093F\u092F \u0939\u0948 \u2014 \u0915\u0947\u0935\u0932 \u0935\u0949\u0907\u0938 \u091A\u0948\u0928\u0932 \u0915\u0947 \u0936\u094D\u0930\u094B\u0924\u093E \u092E\u0941\u091D\u0947 \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964",
    leftIdle: "\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F\u0924\u093E \u0915\u0947 \u0915\u093E\u0930\u0923 \u091A\u0948\u0928\u0932 \u091B\u094B\u0921\u093C \u0926\u093F\u092F\u093E\u0964",
    leftAlone: "\u0938\u092D\u0940 \u091A\u0932\u0947 \u0917\u090F \u0907\u0938\u0932\u093F\u090F \u091A\u0948\u0928\u0932 \u091B\u094B\u0921\u093C \u0926\u093F\u092F\u093E\u0964",
    notSeekable: "\u0907\u0938 \u091F\u094D\u0930\u0948\u0915 \u092E\u0947\u0902 \u0938\u0940\u0915 \u0928\u0939\u0940\u0902 \u0915\u093F\u092F\u093E \u091C\u093E \u0938\u0915\u0924\u093E\u0964",
    queueEnded: "\u0915\u094D\u092F\u0942 \u0938\u092E\u093E\u092A\u094D\u0924 \u0939\u094B \u0917\u0908 \u0939\u0948\u0964",
    pausedLabel: "\u0930\u0941\u0915\u093E \u0939\u0941\u0906",
    addedTitle: "\u0915\u094D\u092F\u0942 \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E",
    addedTopTitle: "\u090A\u092A\u0930 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E",
    skipPlayTitle: "\u0907\u0938 \u092A\u0930 \u091C\u093E \u0930\u0939\u0947 \u0939\u0948\u0902",
    playlistAddedTitle: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u091C\u094B\u0921\u093C\u0940 \u0917\u0908",
    queuePosition: "\u0938\u094D\u0925\u093E\u0928",
    queueTotal: "\u0915\u094D\u092F\u0942",
    totalDuration: "\u0915\u0941\u0932 \u0905\u0935\u0927\u093F",
    searchResultsTitle: "\u0916\u094B\u091C \u092A\u0930\u093F\u0923\u093E\u092E",
    selectFooter: "\u0928\u0940\u091A\u0947 \u090F\u0915 \u091F\u094D\u0930\u0948\u0915 \u091A\u0941\u0928\u0947\u0902",
    selectPlaceholder: "\u091F\u094D\u0930\u0948\u0915 \u091A\u0941\u0928\u0947\u0902\u2026",
    stoppedTitle: "\u0930\u0941\u0915 \u0917\u092F\u093E",
    skippedTitle: "\u091B\u094B\u0921\u093C \u0926\u093F\u092F\u093E",
    previousTitle: "\u092A\u093F\u091B\u0932\u093E \u091F\u094D\u0930\u0948\u0915",
    queueJumpTo: "\u092A\u0947\u091C \u092A\u0930 \u091C\u093E\u090F\u0901\u2026",
    queuePageOption: "\u092A\u0947\u091C {page}",
    npProgress: "\u092A\u094D\u0930\u0917\u0924\u093F",
    removedTitle: "\u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E",
    clearedTitle: "\u0915\u094D\u092F\u0942 \u0916\u093E\u0932\u0940 \u0915\u0940 \u0917\u0908",
    movedTitle: "\u091F\u094D\u0930\u0948\u0915 \u0939\u093F\u0932\u093E\u092F\u093E \u0917\u092F\u093E",
    shuffledTitle: "\u0936\u092B\u093C\u0932 \u0915\u0940 \u0917\u0908",
    loopTitle: "\u0932\u0942\u092A \u092E\u094B\u0921",
    loopCurrent: "\u0932\u0942\u092A \u092E\u094B\u0921 \u0939\u0948 {mode}",
    loopModeOff: "\u092C\u0902\u0926",
    loopModeTrack: "\u091F\u094D\u0930\u0948\u0915",
    loopModeQueue: "\u0915\u094D\u092F\u0942",
    volumeTitle: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E",
    volDown: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E \u221210",
    volUp: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E +10",
    volMute: "\u092E\u094D\u092F\u0942\u091F",
    pausedTitle: "\u0930\u0941\u0915\u093E \u0939\u0941\u0906",
    resumedTitle: "\u092B\u093F\u0930 \u091A\u093E\u0932\u0942",
    seekedTitle: "\u0938\u094D\u0925\u093E\u0928 \u092C\u0926\u0932\u093E \u0917\u092F\u093E",
    forwardedTitle: "\u0906\u0917\u0947 \u092C\u0922\u093C\u093E\u092F\u093E",
    rewoundTitle: "\u092A\u0940\u091B\u0947 \u0915\u093F\u092F\u093E",
    replayingTitle: "\u092B\u093F\u0930 \u0938\u0947 \u091A\u0932 \u0930\u0939\u093E \u0939\u0948",
    joinedTitle: "\u091C\u0941\u0921\u093C \u0917\u092F\u093E",
    grabSource: "\u0938\u094D\u0930\u094B\u0924",
    lyricsSynced: "\u0938\u093F\u0902\u0915\u094D\u0921",
    lyricsPlain: "\u0938\u093E\u0926\u093E",
    autoplayLabel: "\u0911\u091F\u094B\u092A\u094D\u0932\u0947",
    djmodeLabel: "DJ \u092E\u094B\u0921",
    ctrlPrevious: "\u092A\u093F\u091B\u0932\u093E",
    ctrlPause: "\u0930\u094B\u0915\u0947\u0902",
    ctrlResume: "\u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902",
    ctrlSkip: "\u091B\u094B\u0921\u093C\u0947\u0902",
    ctrlLoop: "\u0932\u0942\u092A",
    ctrlStop: "\u092C\u0902\u0926 \u0915\u0930\u0947\u0902",
    ctrlShuffle: "\u0936\u092B\u093C\u0932",
    ctrlQueue: "\u0915\u094D\u092F\u0942",
    ctrlLyrics: "\u092C\u094B\u0932",
    ctrlVolDown: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E \u221210",
    ctrlVolUp: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E +10",
    engineNotReady: "\u092E\u094D\u092F\u0942\u091C\u093C\u093F\u0915 \u0907\u0902\u091C\u0928 \u0905\u092D\u0940 \u091C\u0941\u0921\u093C\u093E \u0928\u0939\u0940\u0902 \u0939\u0948 \u2014 Lavalink \u0905\u092D\u0940 \u0936\u0941\u0930\u0942 \u0939\u094B \u0930\u0939\u093E \u0939\u0948 \u092F\u093E \u092A\u0939\u0941\u0901\u091A \u092F\u094B\u0917\u094D\u092F \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u090F\u0915 \u092E\u093F\u0928\u091F \u092E\u0947\u0902 \u092B\u093F\u0930 \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902 (\u092C\u0949\u091F \u0915\u0902\u0938\u094B\u0932 \u0926\u0947\u0916\u0947\u0902)\u0964",
    skiptoTitle: "\u091F\u094D\u0930\u0948\u0915 \u092A\u0930 \u092A\u0939\u0941\u0901\u091A \u0917\u090F",
    skiptoDone: "\u0938\u0940\u0927\u0947 \u0938\u094D\u0925\u093E\u0928 {index} \u092A\u0930 \u092A\u0939\u0941\u0901\u091A \u0917\u090F \u2014 \u0909\u0938\u0938\u0947 \u092A\u0939\u0932\u0947 \u0915\u093E \u0938\u092C \u0939\u091F\u093E \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    removedDuplicatesTitle: "\u0921\u0941\u092A\u094D\u0932\u093F\u0915\u0947\u091F \u0939\u091F\u093E\u090F \u0917\u090F",
    removedDuplicates: "\u0915\u094D\u092F\u0942 \u0938\u0947 **{count}** \u0921\u0941\u092A\u094D\u0932\u093F\u0915\u0947\u091F \u091F\u094D\u0930\u0948\u0915 \u0939\u091F\u093E\u090F \u0917\u090F\u0964",
    noDuplicates: "\u0915\u094B\u0908 \u0921\u0941\u092A\u094D\u0932\u093F\u0915\u0947\u091F \u091F\u094D\u0930\u0948\u0915 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E \u2014 \u0906\u092A\u0915\u0940 \u0915\u094D\u092F\u0942 \u0938\u093E\u092B\u093C \u0939\u0948!",
    sleepTitle: "\u0938\u094D\u0932\u0940\u092A \u091F\u093E\u0907\u092E\u0930",
    sleepSet: "\u092E\u0948\u0902 {minutes} \u092E\u093F\u0928\u091F \u092E\u0947\u0902 \u092A\u094D\u0932\u0947\u092C\u0948\u0915 \u0930\u094B\u0915 \u0926\u0942\u0901\u0917\u093E\u0964",
    sleepCancelled: "\u0938\u094D\u0932\u0940\u092A \u091F\u093E\u0907\u092E\u0930 \u0930\u0926\u094D\u0926 \u0915\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    sleepStatus: "\u092A\u094D\u0932\u0947\u092C\u0948\u0915 {minutes} \u092E\u093F\u0928\u091F \u092E\u0947\u0902 \u0930\u0941\u0915\u0947\u0917\u093E\u0964",
    sleepNone: "\u0915\u094B\u0908 \u0938\u094D\u0932\u0940\u092A \u091F\u093E\u0907\u092E\u0930 \u0938\u0947\u091F \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 `sleep <\u092E\u093F\u0928\u091F>` \u0938\u0947 \u0938\u0947\u091F \u0915\u0930\u0947\u0902\u0964"
  },
  playlists: {
    created: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F **{name}** \u092C\u0928\u093E\u0908 \u0917\u0908\u0964",
    deleted: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F **{name}** \u0939\u091F\u093E \u0926\u0940 \u0917\u0908\u0964",
    renamed: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F **{old}** \u0915\u093E \u0928\u093E\u092E **{new}** \u0915\u0930 \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    notFound: "\u0906\u092A\u0915\u0940 **{name}** \u0928\u093E\u092E \u0915\u0940 \u0915\u094B\u0908 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    exists: "\u0906\u092A\u0915\u0947 \u092A\u093E\u0938 \u092A\u0939\u0932\u0947 \u0938\u0947 **{name}** \u0928\u093E\u092E \u0915\u0940 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0939\u0948\u0964",
    nameTooLong: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E \u0905\u0927\u093F\u0915\u0924\u092E 64 \u0905\u0915\u094D\u0937\u0930\u094B\u0902 \u0915\u093E \u0939\u094B \u0938\u0915\u0924\u093E \u0939\u0948\u0964",
    addedTracks: "**{name}** \u092E\u0947\u0902 **{count}** \u091F\u094D\u0930\u0948\u0915 \u091C\u094B\u0921\u093C\u0947 \u0917\u090F\u0964",
    addedCurrent: "**{title}** \u0915\u094B **{name}** \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E\u0964",
    noCurrent: "\u0915\u0941\u091B \u0928\u0939\u0940\u0902 \u092C\u091C \u0930\u0939\u093E \u2014 \u0917\u093E\u0928\u0947 \u0915\u093E \u0928\u093E\u092E \u092F\u093E URL \u0926\u0947\u0902\u0964",
    removedTrack: "**{title}** \u0915\u094B **{name}** \u0938\u0947 \u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E\u0964",
    listTitle: "\u0906\u092A\u0915\u0940 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F",
    listEmpty: "\u0906\u092A\u0915\u0947 \u092A\u093E\u0938 \u0905\u092D\u0940 \u0915\u094B\u0908 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    infoTitle: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F: {name}",
    infoFooter: "{count} \u091F\u094D\u0930\u0948\u0915 \u2022 {duration} \u2022 {visibility}",
    public: "\u0938\u093E\u0930\u094D\u0935\u091C\u0928\u093F\u0915",
    private: "\u0928\u093F\u091C\u0940",
    loaded: "**{name}** \u0938\u0947 **{count}** \u091F\u094D\u0930\u0948\u0915 \u0932\u094B\u0921 \u0915\u093F\u090F \u0917\u090F\u0964",
    empty: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F **{name}** \u0916\u093E\u0932\u0940 \u0939\u0948\u0964",
    limitReached: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u092E\u0947\u0902 \u0905\u0927\u093F\u0915\u0924\u092E {limit} \u091F\u094D\u0930\u0948\u0915 \u0939\u094B \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964",
    tooManyToAdd: "\u0907\u0938\u0938\u0947 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u0940 \u0938\u0940\u092E\u093E {limit} \u092A\u093E\u0930 \u0939\u094B \u091C\u093E\u090F\u0917\u0940\u0964",
    favorites: "\u092A\u0938\u0902\u0926\u0940\u0926\u093E",
    favoritesEmpty: "\u0906\u092A\u0915\u0947 \u092A\u093E\u0938 \u0905\u092D\u0940 \u0915\u094B\u0908 \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    favoritesAdded: "**{title}** \u0915\u094B \u0906\u092A\u0915\u0947 \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E\u0964",
    favoritesRemoved: "**{title}** \u0915\u094B \u0906\u092A\u0915\u0947 \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u0938\u0947 \u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E\u0964",
    favoritesLoaded: "**{count}** \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u0932\u094B\u0921 \u0915\u093F\u090F \u0917\u090F\u0964",
    owner: "\u0938\u094D\u0935\u093E\u092E\u0940",
    createdTitle: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u092C\u0928\u093E\u0908 \u0917\u0908",
    deletedTitle: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0939\u091F\u093E\u0908 \u0917\u0908",
    renamedTitle: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E \u092C\u0926\u0932\u093E",
    addedTitle: "\u091F\u094D\u0930\u0948\u0915 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E",
    removedTrackTitle: "\u091F\u094D\u0930\u0948\u0915 \u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E",
    visibilityTitle: "\u0926\u0943\u0936\u094D\u092F\u0924\u093E \u092C\u0926\u0932\u0940 \u0917\u0908",
    loadedTitle: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0932\u094B\u0921 \u0939\u0941\u0908",
    savedQueueTitle: "\u0915\u094D\u092F\u0942 \u0938\u0947\u0935 \u0939\u0941\u0908",
    savedQueue: "\u092E\u094C\u091C\u0942\u0926\u093E \u0915\u094D\u092F\u0942 ({count} \u091F\u094D\u0930\u0948\u0915) \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F **{name}** \u092E\u0947\u0902 \u0938\u0947\u0935 \u0939\u0941\u0908\u0964",
    savedQueueUpdated: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F **{name}** \u092E\u094C\u091C\u0942\u0926\u093E \u0915\u094D\u092F\u0942 ({count} \u091F\u094D\u0930\u0948\u0915) \u0915\u0947 \u0938\u093E\u0925 \u0905\u092A\u0921\u0947\u091F \u0939\u0941\u0908\u0964",
    nothingToSave: "\u0915\u0941\u091B \u092D\u0940 \u0928\u0939\u0940\u0902 \u092C\u091C \u0930\u0939\u093E \u2014 \u0938\u0947\u0935 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u094B\u0908 \u0915\u094D\u092F\u0942 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964"
  },
  filters: {
    applied: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930 **{name}** \u0932\u093E\u0917\u0942 \u0939\u0941\u0906\u0964",
    removed: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930 **{name}** \u0939\u091F\u093E\u092F\u093E \u0917\u092F\u093E\u0964",
    reset: "\u0938\u092D\u0940 \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0930\u0940\u0938\u0947\u091F \u0915\u0930 \u0926\u093F\u090F \u0917\u090F\u0964",
    listTitle: "\u0938\u0915\u094D\u0930\u093F\u092F \u092B\u093C\u093F\u0932\u094D\u091F\u0930",
    listNone: "\u0915\u094B\u0908 \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0938\u0915\u094D\u0930\u093F\u092F \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    invalidLevel: "\u0938\u094D\u0924\u0930 \u0907\u0928\u092E\u0947\u0902 \u0938\u0947 \u090F\u0915 \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F: low, medium, high, insane\u0964",
    invalidValue: "\u092E\u093E\u0928 {min} \u0914\u0930 {max} \u0915\u0947 \u092C\u0940\u091A \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F\u0964",
    eqApplied: "\u0915\u0938\u094D\u091F\u092E \u0907\u0915\u094D\u0935\u0932\u093E\u0907\u091C\u093C\u0930 \u0932\u093E\u0917\u0942 \u0939\u0941\u0906\u0964",
    eqUsage: "\u0909\u092A\u092F\u094B\u0917: `{prefix}eq <-1 \u0938\u0947 1 \u0924\u0915 15 \u0917\u0947\u0928>` \u2014 \u091C\u0948\u0938\u0947 `{prefix}eq 0.3 0.3 0.2 0 -0.2 0 0 0 0 0 0 0 0 0 0`",
    appliedTitle: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0932\u093E\u0917\u0942",
    removedTitle: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0939\u091F\u093E\u092F\u093E",
    resetTitle: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0930\u0940\u0938\u0947\u091F",
    resetAll: "\u0938\u092D\u0940 \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0930\u0940\u0938\u0947\u091F \u0915\u0930\u0947\u0902",
    openPanel: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u092A\u0948\u0928\u0932",
    panelTitle: "\u0911\u0921\u093F\u092F\u094B \u092B\u093C\u093F\u0932\u094D\u091F\u0930",
    panelHint: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091A\u0941\u0928\u0915\u0930 \u091A\u093E\u0932\u0942/\u092C\u0902\u0926 \u0915\u0930\u0947\u0902 \u2014 \u0924\u0941\u0930\u0902\u0924 \u0932\u093E\u0917\u0942 \u0939\u094B\u0924\u093E \u0939\u0948\u0964",
    pickPlaceholder: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091F\u0949\u0917\u0932 \u0915\u0930\u0947\u0902\u2026",
    stateOn: "\u091A\u093E\u0932\u0942 \u2014 \u092C\u0902\u0926 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u091A\u0941\u0928\u0947\u0902",
    stateOff: "\u092C\u0902\u0926 \u2014 \u091A\u093E\u0932\u0942 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u091A\u0941\u0928\u0947\u0902"
  },
  settings: {
    "247": "\u0921\u093F\u092B\u093C\u0949\u0932\u094D\u091F 24/7",
    title: "{guild} \u0915\u0940 \u0938\u0947\u091F\u093F\u0902\u0917",
    prefix: "\u092A\u094D\u0930\u0940\u092B\u093C\u093F\u0915\u094D\u0938",
    language: "\u092D\u093E\u0937\u093E",
    djRoles: "DJ \u0930\u094B\u0932",
    botChannels: "\u0905\u0928\u0941\u092E\u0924 \u091A\u0948\u0928\u0932",
    defaultVolume: "\u0921\u093F\u092B\u093C\u0949\u0932\u094D\u091F \u0935\u0949\u0932\u094D\u092F\u0942\u092E",
    autoplay: "\u0921\u093F\u092B\u093C\u0949\u0932\u094D\u091F \u0911\u091F\u094B\u092A\u094D\u0932\u0947",
    idleTimeout: "\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F\u0924\u093E \u0938\u092E\u092F\u092C\u0926\u094D\u0927\u0924\u093E",
    allChannels: "\u0938\u092D\u0940 \u091A\u0948\u0928\u0932",
    noTimeout: "\u0905\u0915\u094D\u0937\u092E",
    prefixSet: "\u092A\u094D\u0930\u0940\u092B\u093C\u093F\u0915\u094D\u0938 `{prefix}` \u092A\u0930 \u0938\u0947\u091F\u0964",
    prefixInvalid: "\u092A\u094D\u0930\u0940\u092B\u093C\u093F\u0915\u094D\u0938 1-5 \u0905\u0915\u094D\u0937\u0930\u094B\u0902 \u0915\u093E \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F \u0914\u0930 \u0909\u0938\u092E\u0947\u0902 \u0938\u094D\u092A\u0947\u0938 \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u0947\u0964",
    languageSet: "\u092D\u093E\u0937\u093E **{language}** \u092A\u0930 \u0938\u0947\u091F\u0964",
    languageInvalid: "\u0909\u092A\u0932\u092C\u094D\u0927 \u092D\u093E\u0937\u093E\u090F\u0901: {languages}\u0964",
    djRoleAdded: "**{role}** \u0905\u092C DJ \u0930\u094B\u0932 \u0939\u0948\u0964",
    djRoleRemoved: "**{role}** \u0905\u092C DJ \u0930\u094B\u0932 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    djRoleNotSet: "**{role}** DJ \u0930\u094B\u0932 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    djRoleList: "DJ \u0930\u094B\u0932: {roles}",
    djRoleNone: "\u0915\u094B\u0908 DJ \u0930\u094B\u0932 \u0938\u0947\u091F \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    botChannelAdded: "\u0938\u0902\u0917\u0940\u0924 \u0915\u092E\u093E\u0902\u0921 \u0905\u092C **{channel}** \u0924\u0915 \u0938\u0940\u092E\u093F\u0924 \u0939\u0948\u0902\u0964",
    botChannelRemoved: "**{channel}** \u0915\u094B \u0905\u0928\u0941\u092E\u0924 \u091A\u0948\u0928\u0932\u094B\u0902 \u0938\u0947 \u0939\u091F\u093E \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    botChannelNotSet: "**{channel}** \u0905\u0928\u0941\u092E\u0924 \u091A\u0948\u0928\u0932\u094B\u0902 \u092E\u0947\u0902 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
    botChannelCleared: "\u0938\u0902\u0917\u0940\u0924 \u0915\u092E\u093E\u0902\u0921 \u0905\u092C \u0938\u092D\u0940 \u091A\u0948\u0928\u0932\u094B\u0902 \u092E\u0947\u0902 \u0905\u0928\u0941\u092E\u0924 \u0939\u0948\u0902\u0964",
    defaultVolumeSet: "\u0921\u093F\u092B\u093C\u0949\u0932\u094D\u091F \u0935\u0949\u0932\u094D\u092F\u0942\u092E **{level}%** \u092A\u0930 \u0938\u0947\u091F\u0964",
    idleTimeoutSet: "\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F\u0924\u093E \u0938\u092E\u092F\u092C\u0926\u094D\u0927\u0924\u093E **{minutes}** \u092E\u093F\u0928\u091F \u092A\u0930 \u0938\u0947\u091F\u0964",
    idleTimeoutDisabled: "\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F\u0924\u093E \u0938\u092E\u092F\u092C\u0926\u094D\u0927\u0924\u093E \u0905\u0915\u094D\u0937\u092E \u2014 \u0930\u0941\u0915\u0928\u0947 \u0924\u0915 \u092E\u0948\u0902 \u0930\u0939\u0942\u0901\u0917\u093E\u0964"
  },
  info: {
    helpTitle: "Slux \u2014 \u0938\u0939\u093E\u092F\u0924\u093E",
    helpDescription: "\u090F\u0915 \u0938\u0941\u0935\u093F\u0927\u093E \u0938\u0902\u092A\u0928\u094D\u0928 \u0938\u0902\u0917\u0940\u0924 \u092C\u0949\u091F\u0964 \u0938\u094D\u0932\u0948\u0936 \u0915\u092E\u093E\u0902\u0921 \u092F\u093E `{prefix}` \u092A\u094D\u0930\u0940\u092B\u093C\u093F\u0915\u094D\u0938 \u0915\u093E \u0909\u092A\u092F\u094B\u0917 \u0915\u0930\u0947\u0902\u0964",
    helpFields: {
      music: "\u0938\u0902\u0917\u0940\u0924",
      playlists: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F",
      filters: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930",
      settings: "\u0938\u0947\u091F\u093F\u0902\u0917",
      info: "\u091C\u093E\u0928\u0915\u093E\u0930\u0940"
    },
    helpFooter: "\u0938\u092D\u0940 \u0915\u092E\u093E\u0902\u0921 \u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921 \u092A\u0930 \u0926\u0947\u0916\u0947\u0902",
    pingTitle: "\u092A\u094B\u0902\u0917!",
    pingWebsocket: "\u0935\u0947\u092C\u0938\u0949\u0915\u0947\u091F",
    pingRoundtrip: "\u0930\u093E\u0909\u0902\u0921\u091F\u094D\u0930\u093F\u092A",
    pingLavalink: "\u0932\u093E\u0935\u093E\u0932\u093F\u0902\u0915",
    statsTitle: "Slux \u2014 \u0938\u093E\u0902\u0916\u094D\u092F\u093F\u0915\u0940",
    statsServers: "\u0938\u0930\u094D\u0935\u0930",
    statsPlayers: "\u0938\u0915\u094D\u0930\u093F\u092F \u092A\u094D\u0932\u0947\u092F\u0930",
    statsUsers: "\u0909\u092A\u092F\u094B\u0917\u0915\u0930\u094D\u0924\u093E",
    statsUptime: "\u0905\u092A\u091F\u093E\u0907\u092E",
    statsMemory: "\u092E\u0947\u092E\u094B\u0930\u0940",
    statsNode: "\u0932\u093E\u0935\u093E\u0932\u093F\u0902\u0915 \u0928\u094B\u0921",
    statsNodePenalties: "\u0928\u094B\u0921 \u092A\u0947\u0928\u0932\u094D\u091F\u0940",
    inviteTitle: "Slux \u0915\u094B \u0906\u092E\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930\u0947\u0902",
    inviteDescription: "\u0905\u092A\u0928\u0947 \u0938\u0930\u094D\u0935\u0930 \u092E\u0947\u0902 Slux \u091C\u094B\u0921\u093C\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0928\u0940\u091A\u0947 \u092C\u091F\u0928 \u092A\u0930 \u0915\u094D\u0932\u093F\u0915 \u0915\u0930\u0947\u0902\u0964",
    aboutTitle: "Slux \u0915\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902",
    aboutDescription: "Slux \u090F\u0915 \u092E\u0941\u092B\u093C\u094D\u0924, \u0938\u0941\u0935\u093F\u0927\u093E \u0938\u0902\u092A\u0928\u094D\u0928 Discord \u0938\u0902\u0917\u0940\u0924 \u092C\u0949\u091F \u0939\u0948 \u091C\u093F\u0938\u092E\u0947\u0902 Spotify, YouTube, SoundCloud, Deezer, Apple Music \u0914\u0930 \u092C\u0939\u0941\u0924 \u0915\u0941\u091B \u0936\u093E\u092E\u093F\u0932 \u0939\u0948 \u2014 \u0938\u093E\u0925 \u092E\u0947\u0902 \u0930\u093F\u092F\u0932-\u091F\u093E\u0907\u092E \u0935\u0947\u092C \u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921\u0964",
    aboutFooter: "\u2665 \u0915\u0947 \u0938\u093E\u0925 \u092C\u0928\u093E\u092F\u093E \u0917\u092F\u093E \u2014 \u0939\u092E\u0947\u0936\u093E \u092E\u0941\u092B\u093C\u094D\u0924, \u0915\u094B\u0908 \u092A\u094D\u0930\u0940\u092E\u093F\u092F\u092E \u0928\u0939\u0940\u0902",
    helpPickCategory: "\u0915\u092E\u093E\u0902\u0921 \u0936\u094D\u0930\u0947\u0923\u0940 \u091A\u0941\u0928\u0947\u0902\u2026",
    helpCategoryCount: "{count} \u0915\u092E\u093E\u0902\u0921",
    helpAndMore: "+{count} \u0914\u0930",
    helpCommandsTitle: "\u0915\u092E\u093E\u0902\u0921",
    pingStatus: "\u0915\u0928\u0947\u0915\u094D\u0936\u0928 \u0938\u094D\u0925\u093F\u0924\u093F",
    inviteButton: "Slux \u0915\u094B \u0907\u0928\u0935\u093E\u0907\u091F \u0915\u0930\u0947\u0902",
    dashboardButton: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921 \u0916\u094B\u0932\u0947\u0902",
    aboutSources: "\u0938\u094D\u0930\u094B\u0924",
    aboutFeatures: "\u0916\u093E\u0938 \u092C\u093E\u0924\u0947\u0902",
    nodesTitle: "\u092E\u094D\u092F\u0942\u091C\u093C\u093F\u0915 \u0928\u094B\u0921\u094D\u0938",
    nodesActive: "\u0938\u0915\u094D\u0930\u093F\u092F \u0928\u094B\u0921: {name}",
    nodeConnected: "\u091C\u0941\u0921\u093C\u093E \u0939\u0941\u0906",
    nodeConnecting: "\u091C\u0941\u0921\u093C \u0930\u0939\u093E \u0939\u0948\u2026",
    nodeDisconnecting: "\u0905\u0932\u0917 \u0939\u094B \u0930\u0939\u093E \u0939\u0948\u2026",
    nodeDisconnected: "\u092C\u0902\u0926",
    nodePlayers: "\u092A\u094D\u0932\u0947\u092F\u0930",
    nodeCpu: "CPU",
    developerTitle: "SHM \u0926\u094D\u0935\u093E\u0930\u093E \u0928\u093F\u0930\u094D\u092E\u093F\u0924",
    developerDescription: "Slux \u0915\u094B **SHM** \u0928\u0947 \u0921\u093F\u091C\u093C\u093E\u0907\u0928, \u092C\u0928\u093E\u092F\u093E \u0914\u0930 \u0938\u0902\u092D\u093E\u0932\u093E \u0939\u0948\u0964 \u0939\u0930 \u092B\u093C\u0940\u091A\u0930 \u2014 \u092A\u094D\u0932\u0947\u092F\u0930 \u0907\u0902\u091C\u0928, \u092B\u093C\u093F\u0932\u094D\u091F\u0930, \u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921 \u0914\u0930 \u092C\u094B\u0932 \u2014 \u092A\u094D\u092F\u093E\u0930 \u0938\u0947 \u092C\u0928\u093E\u092F\u093E \u0917\u092F\u093E \u0939\u0948\u0964",
    developerRole: "\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E \u0914\u0930 \u0921\u0947\u0935\u0932\u092A\u0930",
    developerWorkTitle: "\u092A\u094D\u0930\u094B\u091C\u0947\u0915\u094D\u091F",
    developerWork: "\u0910\u0938\u0947 \u092A\u094D\u0930\u094B\u091C\u0947\u0915\u094D\u091F\u094D\u0938 \u0915\u0947 \u092C\u093F\u0932\u094D\u0921 \u0935\u0940\u0921\u093F\u092F\u094B, \u0921\u0947\u0935 \u0932\u0949\u0917\u094D\u0938 \u0914\u0930 \u091F\u094D\u092F\u0942\u091F\u094B\u0930\u093F\u092F\u0932 \u0915\u0947 \u0932\u093F\u090F YouTube \u092A\u0930 **@Letzforge** \u0915\u094B \u092B\u0949\u0932\u094B \u0915\u0930\u0947\u0902\u0964",
    developerFooter: "SHM \u0926\u094D\u0935\u093E\u0930\u093E \u2764\uFE0F \u0938\u0947 \u092C\u0928\u093E\u092F\u093E \u0917\u092F\u093E"
  },
  dashboard: {
    nav: {
      player: "\u092A\u094D\u0932\u0947\u092F\u0930",
      settings: "\u0938\u0947\u091F\u093F\u0902\u0917",
      playlists: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F",
      backToSite: "\u0938\u093E\u0907\u091F \u092A\u0930 \u0935\u093E\u092A\u0938",
      logout: "\u0932\u0949\u0917 \u0906\u0909\u091F",
      dashboard: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921",
      commands: "\u0915\u092E\u093E\u0902\u0921",
      theme: "\u0925\u0940\u092E"
    },
    landing: {
      badge: "\u0939\u092E\u0947\u0936\u093E \u092E\u0941\u092B\u093C\u094D\u0924 \u2014 \u0915\u094B\u0908 \u092A\u094D\u0930\u0940\u092E\u093F\u092F\u092E \u0928\u0939\u0940\u0902",
      title: "\u0938\u0902\u0917\u0940\u0924 \u091C\u094B \u0915\u092D\u0940 \u092C\u0940\u091F \u0928\u0939\u0940\u0902 \u091B\u094B\u0921\u093C\u0924\u093E",
      subtitle: "Slux \u090F\u0915 \u0938\u0941\u0935\u093F\u0927\u093E \u0938\u0902\u092A\u0928\u094D\u0928 Discord \u0938\u0902\u0917\u0940\u0924 \u092C\u0949\u091F \u0939\u0948 \u091C\u093F\u0938\u092E\u0947\u0902 Spotify, YouTube, SoundCloud, Deezer \u0914\u0930 Apple Music \u0938\u092E\u0930\u094D\u0925\u0928 \u0939\u0948 \u2014 \u0938\u093E\u0925 \u092E\u0947\u0902 \u0905\u092A\u0928\u0947 \u092C\u094D\u0930\u093E\u0909\u091C\u093C\u0930 \u0938\u0947 \u0938\u092C \u0915\u0941\u091B \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0930\u093F\u092F\u0932-\u091F\u093E\u0907\u092E \u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921\u0964",
      addDiscord: "Discord \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u0947\u0902",
      openDashboard: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921 \u0916\u094B\u0932\u0947\u0902",
      featuresTitle: "\u091C\u094B \u0915\u0941\u091B \u0906\u092A\u0915\u094B \u091A\u093E\u0939\u093F\u090F",
      featuresSubtitle: "\u0938\u092D\u0940 \u0938\u0941\u0935\u093F\u0927\u093E\u090F\u0901, \u0938\u092C\u0915\u0947 \u0932\u093F\u090F \u092E\u0941\u092B\u093C\u094D\u0924\u0964 \u092F\u0939\u0940 Slux \u0915\u093E \u0935\u093E\u0926\u093E \u0939\u0948\u0964",
      sourcesTitle: "\u0906\u092A\u0915\u0947 \u0938\u092D\u0940 \u0938\u094D\u0930\u094B\u0924",
      sourcesDescription: "Spotify, YouTube, SoundCloud, Deezer, Apple Music, Tidal \u0914\u0930 YouTube Music \u0938\u0947 \u0916\u094B\u091C\u0947\u0902 \u0914\u0930 \u092C\u091C\u093E\u090F\u0901\u0964",
      filtersTitle: "\u0938\u094D\u091F\u0942\u0921\u093F\u092F\u094B-\u0938\u094D\u0924\u0930\u0940\u092F \u092B\u093C\u093F\u0932\u094D\u091F\u0930",
      filtersDescription: "Bassboost, nightcore, vaporwave, 8D, karaoke \u0914\u0930 \u092A\u0942\u0930\u093E 15-\u092C\u0948\u0902\u0921 \u0907\u0915\u094D\u0935\u0932\u093E\u0907\u091C\u093C\u0930\u0964",
      playlistsTitle: "\u0936\u0915\u094D\u0924\u093F\u0936\u093E\u0932\u0940 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F",
      playlistsDescription: "\u0905\u092A\u0928\u0947 \u092A\u0938\u0902\u0926\u0940\u0926\u093E \u091F\u094D\u0930\u0948\u0915 \u0938\u0939\u0947\u091C\u0947\u0902, \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0906\u092F\u093E\u0924 \u0915\u0930\u0947\u0902 \u0914\u0930 \u090F\u0915 \u0915\u092E\u093E\u0902\u0921 \u092E\u0947\u0902 \u0932\u094B\u0921 \u0915\u0930\u0947\u0902\u0964",
      lyricsTitle: "\u0938\u093F\u0902\u0915\u094D\u0921 \u092C\u094B\u0932",
      lyricsDescription: "Discord \u092F\u093E \u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921 \u092A\u0930 \u0938\u092E\u092F-\u0938\u093F\u0902\u0915\u094D\u0921 \u092C\u094B\u0932 \u0915\u0947 \u0938\u093E\u0925 \u0938\u093E\u0925 \u0917\u093E\u090F\u0901\u0964",
      dashboardTitle: "\u0930\u093F\u092F\u0932-\u091F\u093E\u0907\u092E \u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921",
      dashboardDescription: "\u0905\u092A\u0928\u0947 \u092C\u094D\u0930\u093E\u0909\u091C\u093C\u0930 \u0938\u0947 \u092A\u094D\u0932\u0947\u092C\u0948\u0915 \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930\u0947\u0902, \u0915\u094D\u092F\u0942 \u092A\u094D\u0930\u092C\u0902\u0927\u093F\u0924 \u0915\u0930\u0947\u0902 \u0914\u0930 \u092C\u0949\u091F \u0915\u0949\u0928\u094D\u092B\u093C\u093F\u0917\u0930 \u0915\u0930\u0947\u0902\u0964",
      autoplayTitle: "\u0911\u091F\u094B\u092A\u094D\u0932\u0947 \u0914\u0930 24/7",
      autoplayDescription: "Slux \u0938\u0902\u092C\u0902\u0927\u093F\u0924 \u091F\u094D\u0930\u0948\u0915 \u0915\u0947 \u0938\u093E\u0925 \u0938\u0902\u0917\u0940\u0924 \u091C\u093E\u0930\u0940 \u0930\u0916\u0924\u093E \u0939\u0948 \u0914\u0930 \u092A\u0942\u0930\u0947 \u0926\u093F\u0928 \u0935\u0949\u0907\u0938 \u092E\u0947\u0902 \u0930\u0939 \u0938\u0915\u0924\u093E \u0939\u0948\u0964",
      i18nTitle: "\u0906\u092A\u0915\u0940 \u092D\u093E\u0937\u093E \u092C\u094B\u0932\u0924\u093E \u0939\u0948",
      i18nDescription: "\u0905\u0902\u0917\u094D\u0930\u0947\u091C\u093C\u0940, \u0939\u093F\u0928\u094D\u0926\u0940, \u0938\u094D\u092A\u0947\u0928\u093F\u0936, \u092B\u093C\u094D\u0930\u0947\u0902\u091A, \u091C\u0930\u094D\u092E\u0928 \u0914\u0930 \u092A\u0941\u0930\u094D\u0924\u0917\u093E\u0932\u0940 \u092A\u0939\u0932\u0947 \u0938\u0947 \u0936\u093E\u092E\u093F\u0932\u0964",
      statsServers: "\u0938\u0930\u094D\u0935\u0930",
      statsPlayers: "\u0938\u0915\u094D\u0930\u093F\u092F \u092A\u094D\u0932\u0947\u092F\u0930",
      statsTracks: "\u091F\u094D\u0930\u0948\u0915 \u092C\u091C\u093E\u090F \u0917\u090F",
      ctaTitle: "\u0905\u092A\u0928\u0947 \u0938\u0930\u094D\u0935\u0930 \u0915\u0940 \u0927\u094D\u0935\u0928\u093F \u0905\u092A\u0917\u094D\u0930\u0947\u0921 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0924\u0948\u092F\u093E\u0930?",
      ctaSubtitle: "Slux \u0915\u094B \u090F\u0915 \u092E\u093F\u0928\u091F \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u0947\u0902\u0964 \u0915\u094B\u0908 \u0938\u0947\u091F\u0905\u092A \u0928\u0939\u0940\u0902, \u0915\u094B\u0908 \u092A\u094D\u0930\u0940\u092E\u093F\u092F\u092E \u0928\u0939\u0940\u0902, \u0915\u094B\u0908 \u0938\u0940\u092E\u093E \u0928\u0939\u0940\u0902\u0964"
    },
    commands: {
      title: "\u0915\u092E\u093E\u0902\u0921",
      subtitle: "\u0938\u092C \u0915\u0941\u091B \u091C\u094B Slux \u0915\u0930 \u0938\u0915\u0924\u093E \u0939\u0948 \u2014 {count} \u0915\u092E\u093E\u0902\u0921 \u092E\u0947\u0902",
      search: "\u0915\u092E\u093E\u0902\u0921 \u0916\u094B\u091C\u0947\u0902...",
      noResults: "\u0915\u094B\u0908 \u0915\u092E\u093E\u0902\u0921 \u0906\u092A\u0915\u0940 \u0916\u094B\u091C \u0938\u0947 \u092E\u0947\u0932 \u0928\u0939\u0940\u0902 \u0916\u093E\u0924\u0940\u0964",
      usage: "\u0909\u092A\u092F\u094B\u0917"
    },
    guilds: {
      title: "\u0906\u092A\u0915\u0947 \u0938\u0930\u094D\u0935\u0930",
      subtitle: "\u092A\u094D\u0930\u092C\u0902\u0927\u093F\u0924 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u090F\u0915 \u0938\u0930\u094D\u0935\u0930 \u091A\u0941\u0928\u0947\u0902",
      invite: "\u0906\u092E\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930\u0947\u0902",
      manage: "\u092A\u094D\u0930\u092C\u0902\u0927\u093F\u0924 \u0915\u0930\u0947\u0902",
      empty: "Manage Server \u0905\u0928\u0941\u092E\u0924\u093F \u0935\u093E\u0932\u093E \u0915\u094B\u0908 \u0938\u0930\u094D\u0935\u0930 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E\u0964"
    },
    settings: {
      title: "\u0938\u0947\u091F\u093F\u0902\u0917",
      general: "\u0938\u093E\u092E\u093E\u0928\u094D\u092F",
      playback: "\u092A\u094D\u0932\u0947\u092C\u0948\u0915",
      dj: "DJ",
      prefix: "\u0915\u092E\u093E\u0902\u0921 \u092A\u094D\u0930\u0940\u092B\u093C\u093F\u0915\u094D\u0938",
      prefixDescription: "\u091F\u0947\u0915\u094D\u0938\u094D\u091F \u0915\u092E\u093E\u0902\u0921 \u0915\u0947 \u0932\u093F\u090F \u092A\u094D\u0930\u0940\u092B\u093C\u093F\u0915\u094D\u0938",
      language: "\u092D\u093E\u0937\u093E",
      languageDescription: "\u092C\u0949\u091F \u092A\u094D\u0930\u0924\u093F\u0915\u094D\u0930\u093F\u092F\u093E\u0913\u0902 \u0915\u0940 \u092D\u093E\u0937\u093E",
      defaultVolume: "\u0921\u093F\u092B\u093C\u0949\u0932\u094D\u091F \u0935\u0949\u0932\u094D\u092F\u0942\u092E",
      defaultVolumeDescription: "\u092A\u094D\u0932\u0947\u092F\u0930 \u0936\u0941\u0930\u0942 \u0939\u094B\u0928\u0947 \u092A\u0930 \u0935\u0949\u0932\u094D\u092F\u0942\u092E",
      autoplay: "\u0911\u091F\u094B\u092A\u094D\u0932\u0947",
      autoplayDescription: "\u0915\u094D\u092F\u0942 \u0938\u092E\u093E\u092A\u094D\u0924 \u0939\u094B\u0928\u0947 \u092A\u0930 \u0938\u0902\u092C\u0902\u0927\u093F\u0924 \u091F\u094D\u0930\u0948\u0915 \u092C\u091C\u093E\u0924\u0947 \u0930\u0939\u0947\u0902",
      stay247: "24/7 \u092E\u094B\u0921",
      stay247Description: "\u0905\u0915\u0947\u0932\u0947 \u092F\u093E \u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F \u0939\u094B\u0928\u0947 \u092A\u0930 \u0935\u0949\u0907\u0938 \u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0930\u0939\u0947\u0902",
      idleTimeout: "\u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F\u0924\u093E \u0938\u092E\u092F\u092C\u0926\u094D\u0927\u0924\u093E",
      idleTimeoutDescription: "\u0907\u0924\u0928\u0947 \u092E\u093F\u0928\u091F \u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F \u0930\u0939\u0928\u0947 \u092A\u0930 \u091A\u0932\u0947 \u091C\u093E\u090F\u0901 (0 = \u0915\u092D\u0940 \u0928\u0939\u0940\u0902)",
      djRoles: "DJ \u0930\u094B\u0932",
      djRolesDescription: "\u0935\u0947 \u0930\u094B\u0932 \u091C\u094B DJ \u0915\u092E\u093E\u0902\u0921 \u0909\u092A\u092F\u094B\u0917 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902",
      botChannels: "\u0905\u0928\u0941\u092E\u0924 \u091A\u0948\u0928\u0932",
      botChannelsDescription: "\u0938\u0902\u0917\u0940\u0924 \u0915\u092E\u093E\u0902\u0921 \u0907\u0928 \u091A\u0948\u0928\u0932\u094B\u0902 \u0924\u0915 \u0938\u0940\u092E\u093F\u0924 \u0915\u0930\u0947\u0902",
      allChannels: "\u0938\u092D\u0940 \u091A\u0948\u0928\u0932 \u0905\u0928\u0941\u092E\u0924 \u0939\u0948\u0902",
      save: "\u092A\u0930\u093F\u0935\u0930\u094D\u0924\u0928 \u0938\u0939\u0947\u091C\u0947\u0902",
      saved: "\u0938\u0947\u091F\u093F\u0902\u0917 \u0938\u0939\u0947\u091C \u0932\u0940 \u0917\u0908\u0902",
      saveFailed: "\u0938\u0947\u091F\u093F\u0902\u0917 \u0938\u0939\u0947\u091C\u0928\u0947 \u092E\u0947\u0902 \u0935\u093F\u092B\u0932",
      notAvailable: "\u0938\u0930\u094D\u0935\u0930 \u0909\u092A\u0932\u092C\u094D\u0927 \u0928\u0939\u0940\u0902 \u2014 \u0915\u094D\u092F\u093E \u092C\u0949\u091F \u0909\u0938\u092E\u0947\u0902 \u0939\u0948?"
    },
    player: {
      title: "\u092A\u094D\u0932\u0947\u092F\u0930",
      notConnected: "\u091C\u0941\u0921\u093C\u093E \u0928\u0939\u0940\u0902 \u0939\u0948",
      notConnectedDescription: "Slux \u0935\u0949\u0907\u0938 \u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u0938\u0941\u0928\u0928\u093E \u0936\u0941\u0930\u0942 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u090F\u0915 \u091A\u0948\u0928\u0932 \u091A\u0941\u0928\u0947\u0902\u0964",
      join: "\u091A\u0948\u0928\u0932 \u092E\u0947\u0902 \u0936\u093E\u092E\u093F\u0932 \u0939\u094B\u0902",
      nowPlaying: "\u0905\u092C \u092C\u091C \u0930\u0939\u093E \u0939\u0948",
      nothingPlaying: "\u0915\u0941\u091B \u0928\u0939\u0940\u0902 \u092C\u091C \u0930\u0939\u093E",
      queue: "\u0915\u094D\u092F\u0942",
      queueEmpty: "\u0915\u094D\u092F\u0942 \u0916\u093E\u0932\u0940 \u0939\u0948 \u2014 \u0915\u0941\u091B \u0916\u094B\u091C\u0947\u0902!",
      lyrics: "\u092C\u094B\u0932",
      noLyrics: "\u0907\u0938 \u091F\u094D\u0930\u0948\u0915 \u0915\u0947 \u0932\u093F\u090F \u0915\u094B\u0908 \u092C\u094B\u0932 \u0909\u092A\u0932\u092C\u094D\u0927 \u0928\u0939\u0940\u0902\u0964",
      searchPlaceholder: "\u0916\u094B\u091C\u0947\u0902 \u092F\u093E \u0932\u093F\u0902\u0915 \u092A\u0947\u0938\u094D\u091F \u0915\u0930\u0947\u0902...",
      play: "\u092C\u091C\u093E\u090F\u0901",
      pause: "\u0930\u094B\u0915\u0947\u0902",
      resume: "\u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902",
      previous: "\u092A\u093F\u091B\u0932\u093E",
      skip: "\u091B\u094B\u0921\u093C\u0947\u0902",
      stop: "\u0930\u094B\u0915\u0947\u0902",
      shuffle: "\u0936\u092B\u093C\u0932",
      loop: "\u0932\u0942\u092A",
      volume: "\u0935\u0949\u0932\u094D\u092F\u0942\u092E",
      autoplay: "\u0911\u091F\u094B\u092A\u094D\u0932\u0947",
      clear: "\u0915\u094D\u092F\u0942 \u0938\u093E\u092B\u093C \u0915\u0930\u0947\u0902",
      remove: "\u0939\u091F\u093E\u090F\u0901",
      moveTop: "\u090A\u092A\u0930 \u0932\u0947 \u091C\u093E\u090F\u0901",
      added: "\u0915\u094D\u092F\u0942 \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E",
      live: "\u0932\u093E\u0907\u0935",
      lyricsSynced: "\u0938\u093F\u0902\u0915\u094D\u0921",
      lyricsPlain: "\u0938\u093E\u0926\u093E",
      autoScroll: "\u0911\u091F\u094B-\u0938\u094D\u0915\u094D\u0930\u0949\u0932",
      history: "\u0907\u0924\u093F\u0939\u093E\u0938",
      historyEmpty: "\u0907\u0924\u093F\u0939\u093E\u0938 \u0905\u092D\u0940 \u0916\u093E\u0932\u0940 \u0939\u0948\u0964",
      replay: "\u092B\u093F\u0930 \u0938\u0947 \u091A\u0932\u093E\u090F\u0901",
      filtersTab: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930",
      filtersNone: "\u0915\u094B\u0908 \u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u091A\u093E\u0932\u0942 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
      filtersReset: "\u092B\u093C\u093F\u0932\u094D\u091F\u0930 \u0930\u0940\u0938\u0947\u091F \u0915\u0930\u0947\u0902",
      seekHint: "\u0938\u0940\u0915 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0916\u0940\u0902\u091A\u0947\u0902",
      requestedBy: "\u0905\u0928\u0941\u0930\u094B\u0927\u0915\u0930\u094D\u0924\u093E",
      playingIn: "\u092C\u091C \u0930\u0939\u093E \u0939\u0948",
      realtimeOff: "\u0930\u0940\u092F\u0932-\u091F\u093E\u0907\u092E \u092C\u0902\u0926 \u0939\u0948"
    },
    playlists: {
      title: "\u0906\u092A\u0915\u0940 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F",
      subtitle: "\u0906\u092A\u0915\u0947 \u0938\u0939\u0947\u091C\u0947 \u0938\u0902\u0917\u094D\u0930\u0939, \u0915\u093F\u0938\u0940 \u092D\u0940 \u0938\u0930\u094D\u0935\u0930 \u092A\u0930 \u0909\u092A\u0932\u092C\u094D\u0927",
      create: "\u0928\u0908 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F",
      createTitle: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u092C\u0928\u093E\u090F\u0901",
      namePlaceholder: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0915\u093E \u0928\u093E\u092E",
      descriptionPlaceholder: "\u0935\u093F\u0935\u0930\u0923 (\u0935\u0948\u0915\u0932\u094D\u092A\u093F\u0915)",
      createCta: "\u092C\u0928\u093E\u090F\u0901",
      delete: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0939\u091F\u093E\u090F\u0901",
      deleteConfirm: '\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F "{name}" \u0939\u091F\u093E\u090F\u0901? \u0907\u0938\u0947 \u092A\u0942\u0930\u094D\u0935\u0935\u0924 \u0928\u0939\u0940\u0902 \u0915\u093F\u092F\u093E \u091C\u093E \u0938\u0915\u0924\u093E\u0964',
      public: "\u0938\u093E\u0930\u094D\u0935\u091C\u0928\u093F\u0915",
      private: "\u0928\u093F\u091C\u0940",
      tracks: "\u091F\u094D\u0930\u0948\u0915",
      empty: "\u0905\u092D\u0940 \u0915\u094B\u0908 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0928\u0939\u0940\u0902 \u2014 \u0905\u092A\u0928\u0940 \u092A\u0939\u0932\u0940 \u092C\u0928\u093E\u090F\u0901!",
      loadToGuild: "\u090F\u0915 \u0938\u0930\u094D\u0935\u0930 \u092E\u0947\u0902 \u092C\u091C\u093E\u090F\u0901",
      removeTrack: "\u091F\u094D\u0930\u0948\u0915 \u0939\u091F\u093E\u090F\u0901",
      created: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u092C\u0928 \u0917\u0908",
      deleted: "\u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0939\u091F\u093E \u0926\u0940 \u0917\u0908",
      emptyPlaylist: "\u092F\u0939 \u092A\u094D\u0932\u0947\u0932\u093F\u0938\u094D\u091F \u0916\u093E\u0932\u0940 \u0939\u0948\u0964"
    },
    auth: {
      login: "Discord \u0938\u0947 \u0932\u0949\u0917\u093F\u0928 \u0915\u0930\u0947\u0902",
      loginRequired: "\u0932\u0949\u0917\u093F\u0928 \u0906\u0935\u0936\u094D\u092F\u0915",
      loginRequiredDescription: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921 \u0924\u0915 \u092A\u0939\u0941\u0901\u091A\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0906\u092A\u0915\u094B Discord \u0938\u0947 \u0932\u0949\u0917\u093F\u0928 \u0915\u0930\u0928\u093E \u0939\u094B\u0917\u093E\u0964"
    },
    user: {
      loggedInAs: "\u0907\u0938 \u0930\u0942\u092A \u092E\u0947\u0902 \u0932\u0949\u0917\u093F\u0928 \u0939\u0948"
    }
  }
};

// src/i18n/locales/es.json
var es_default = {
  common: {
    error: "Algo sali\xF3 mal. Por favor, int\xE9ntalo de nuevo.",
    noVoiceChannel: "Primero debes unirte a un canal de voz.",
    noPlayer: "No se est\xE1 reproduciendo nada en este momento.",
    notInSameVoice: "Debes estar en el mismo canal de voz que yo.",
    queueEmpty: "La cola est\xE1 vac\xEDa.",
    cancelled: "Cancelado.",
    timeUp: "Tiempo agotado.",
    djRequired: "Necesitas un rol de DJ o el permiso Administrar canales para usar este comando.",
    manageGuildRequired: "Necesitas el permiso Administrar servidor para usar este comando.",
    blacklisted: "No tienes permiso para usar este bot.",
    nothingFound: "No se encontr\xF3 nada para esa b\xFAsqueda.",
    invalidNumber: "Por favor, proporciona un n\xFAmero v\xE1lido.",
    page: "P\xE1gina {current}/{total}",
    requestedBy: "Solicitado por {user}",
    unknownCommand: "Comando desconocido. Prueba `{prefix}help`.",
    yes: "S\xED",
    no: "No",
    enabled: "Activado",
    disabled: "Desactivado",
    none: "Ninguno",
    minutes: "minutos",
    tracks: "canciones",
    errorTitle: "Error",
    doneTitle: "Hecho",
    warnTitle: "Atenci\xF3n",
    on: "S\xCD",
    off: "NO",
    commands: "comandos",
    viewExpired: "Esta vista ha caducado \u2014 ejecuta el comando de nuevo.",
    cooldown: "Est\xE1s usando comandos demasiado r\xE1pido \u2014 int\xE9ntalo de nuevo en unos segundos.",
    channelNotAllowed: "Los comandos no est\xE1n permitidos en este canal.",
    mentionHelp: {
      title: "\xA1Hola, soy Slux!",
      description: "El bot de m\xFAsica de tu servidor \u2014 b\xFAsqueda, cola, letras, filtros y un panel web en vivo. As\xED se usa:",
      prefixField: "Prefijo aqu\xED",
      prefixValue: "Usa {prefix} antes de los comandos, p. ej. {prefix}play",
      slashField: "Comandos slash",
      slashValue: "Escribe `/` en cualquier sitio y elige un comando.",
      popularField: "Comandos populares",
      tipField: "Consejo",
      tipValue: "Menci\xF3name cuando quieras para ver este mensaje, o usa {prefix}help para la lista completa.",
      commandsButton: "Todos los comandos",
      dashboardButton: "Panel",
      inviteButton: "Inv\xEDtame"
    }
  },
  commands: {
    "247": {
      name: "247",
      description: "Activa o desactiva quedarse en el canal 24/7"
    },
    play: {
      name: "play",
      description: "Reproduce una canci\xF3n, lista o b\xFAsqueda",
      options: {
        query: "Nombre de la canci\xF3n, URL o enlace de lista"
      }
    },
    playnext: {
      name: "playnext",
      description: "A\xF1ade una canci\xF3n para reproducir justo despu\xE9s de la actual",
      options: {
        query: "Nombre de la canci\xF3n o URL"
      }
    },
    playtop: {
      name: "playtop",
      description: "A\xF1ade una canci\xF3n al principio de la cola",
      options: {
        query: "Nombre de la canci\xF3n o URL"
      }
    },
    playskip: {
      name: "playskip",
      description: "A\xF1ade una canci\xF3n al principio y salta inmediatamente a ella",
      options: {
        query: "Nombre de la canci\xF3n o URL"
      }
    },
    pause: {
      name: "pause",
      description: "Pausa la canci\xF3n actual"
    },
    resume: {
      name: "resume",
      description: "Reanuda la canci\xF3n en pausa"
    },
    stop: {
      name: "stop",
      description: "Detiene la reproducci\xF3n, vac\xEDa la cola y se va"
    },
    skip: {
      name: "skip",
      description: "Salta la canci\xF3n actual"
    },
    previous: {
      name: "previous",
      description: "Reproduce la canci\xF3n anterior del historial"
    },
    seek: {
      name: "seek",
      description: "Salta a una posici\xF3n de la canci\xF3n actual",
      options: {
        position: "Posici\xF3n como 1:30, 90 o 1m30s"
      }
    },
    forward: {
      name: "forward",
      description: "Avanza un n\xFAmero de segundos",
      options: {
        seconds: "Segundos a avanzar"
      }
    },
    rewind: {
      name: "rewind",
      description: "Retrocede un n\xFAmero de segundos",
      options: {
        seconds: "Segundos a retroceder"
      }
    },
    queue: {
      name: "queue",
      description: "Muestra la cola actual",
      options: {
        page: "N\xFAmero de p\xE1gina"
      }
    },
    nowplaying: {
      name: "nowplaying",
      description: "Muestra la canci\xF3n que se est\xE1 reproduciendo"
    },
    remove: {
      name: "remove",
      description: "Elimina una canci\xF3n de la cola",
      options: {
        index: "La posici\xF3n de la cola a eliminar"
      }
    },
    clear: {
      name: "clear",
      description: "Vac\xEDa toda la cola"
    },
    move: {
      name: "move",
      description: "Mueve una canci\xF3n dentro de la cola",
      options: {
        from: "Posici\xF3n de origen",
        to: "Posici\xF3n de destino"
      }
    },
    shuffle: {
      name: "shuffle",
      description: "Baraja la cola"
    },
    loop: {
      name: "loop",
      description: "Establece el modo de repetici\xF3n",
      options: {
        mode: "Modo: off, track o queue"
      }
    },
    volume: {
      name: "volume",
      description: "Establece o consulta el volumen",
      options: {
        level: "Volumen de 0 a 150"
      }
    },
    join: {
      name: "join",
      description: "\xDAnete a tu canal de voz"
    },
    replay: {
      name: "replay",
      description: "Repite la canci\xF3n actual desde el principio"
    },
    grab: {
      name: "grab",
      description: "Recibe la canci\xF3n actual por mensaje directo"
    },
    search: {
      name: "search",
      description: "Busca canciones y elige una",
      options: {
        query: "Qu\xE9 buscar"
      }
    },
    lyrics: {
      name: "lyrics",
      description: "Muestra la letra de la canci\xF3n actual"
    },
    autoplay: {
      name: "autoplay",
      description: "Activa o desactiva la reproducci\xF3n autom\xE1tica"
    },
    djmode: {
      name: "djmode",
      description: "Activa el modo DJ: solo los miembros del canal controlan el bot"
    },
    playlist: {
      name: "playlist",
      description: "Gestiona tus listas de reproducci\xF3n",
      subcommands: {
        create: {
          description: "Crea una nueva lista",
          options: {
            name: "Nombre de la lista"
          }
        },
        delete: {
          description: "Elimina una de tus listas",
          options: {
            name: "Nombre de la lista"
          }
        },
        rename: {
          description: "Renombra una de tus listas",
          options: {
            old: "Nombre actual",
            new: "Nuevo nombre"
          }
        },
        add: {
          description: "A\xF1ade una canci\xF3n o enlace a una lista",
          options: {
            name: "Nombre de la lista",
            query: "Canci\xF3n o URL"
          }
        },
        remove: {
          description: "Elimina una canci\xF3n por posici\xF3n",
          options: {
            name: "Nombre de la lista",
            index: "Posici\xF3n de la canci\xF3n"
          }
        },
        list: {
          description: "Lista tus listas de reproducci\xF3n"
        },
        info: {
          description: "Muestra las canciones de una lista",
          options: {
            name: "Nombre de la lista"
          }
        },
        load: {
          description: "Carga una lista en la cola",
          options: {
            name: "Nombre de la lista"
          }
        },
        public: {
          description: "Alterna una lista entre p\xFAblica y privada",
          options: {
            name: "Nombre de la lista"
          }
        },
        save: {
          description: "Guarda la cola actual como playlist",
          options: {
            name: "Nombre de la playlist"
          }
        }
      }
    },
    favorites: {
      name: "favorites",
      description: "Gestiona tus canciones favoritas",
      subcommands: {
        add: {
          description: "A\xF1ade la canci\xF3n actual o una b\xFAsqueda a favoritos",
          options: {
            query: "Nombre o URL (vac\xEDo = canci\xF3n actual)"
          }
        },
        remove: {
          description: "Elimina un favorito por posici\xF3n",
          options: {
            index: "Posici\xF3n del favorito"
          }
        },
        list: {
          description: "Lista tus favoritos"
        },
        play: {
          description: "Reproduce tus favoritos"
        }
      }
    },
    bassboost: {
      name: "bassboost",
      description: "Activa o desactiva el filtro bassboost",
      options: {
        level: "Nivel: low, medium, high o insane"
      }
    },
    nightcore: {
      name: "nightcore",
      description: "Activa o desactiva el filtro nightcore"
    },
    vaporwave: {
      name: "vaporwave",
      description: "Activa o desactiva el filtro vaporwave"
    },
    soft: {
      name: "soft",
      description: "Activa o desactiva el filtro soft"
    },
    "8d": {
      name: "8d",
      description: "Activa o desactiva el filtro de audio 8D"
    },
    karaoke: {
      name: "karaoke",
      description: "Activa o desactiva el filtro karaoke"
    },
    tremolo: {
      name: "tremolo",
      description: "Activa o desactiva el filtro tremolo"
    },
    vibrato: {
      name: "vibrato",
      description: "Activa o desactiva el filtro vibrato"
    },
    distortion: {
      name: "distortion",
      description: "Activa o desactiva el filtro distortion"
    },
    lowpass: {
      name: "lowpass",
      description: "Activa o desactiva el filtro lowpass"
    },
    speed: {
      name: "speed",
      description: "Establece la velocidad de reproducci\xF3n",
      options: {
        value: "Velocidad de 0.5 a 5.0"
      }
    },
    pitch: {
      name: "pitch",
      description: "Establece el tono",
      options: {
        value: "Tono de 0.5 a 5.0"
      }
    },
    eq: {
      name: "eq",
      description: "Establece un ecualizador personalizado como 3 0 0 1 0 -1",
      options: {
        bands: "15 ganancias de -1 a 1"
      }
    },
    filters: {
      name: "filters",
      description: "Muestra los filtros activos"
    },
    filtersreset: {
      name: "reset",
      description: "Restablece todos los filtros"
    },
    settings: {
      name: "settings",
      description: "Muestra la configuraci\xF3n del servidor"
    },
    prefix: {
      name: "prefix",
      description: "Establece el prefijo de comandos para este servidor",
      options: {
        prefix: "Nuevo prefijo, hasta 5 caracteres"
      }
    },
    language: {
      name: "language",
      description: "Establece el idioma del bot para este servidor",
      options: {
        language: "Idioma a usar"
      }
    },
    djrole: {
      name: "djrole",
      description: "Gestiona los roles de DJ",
      subcommands: {
        add: {
          description: "A\xF1ade un rol de DJ",
          options: {
            role: "El rol"
          }
        },
        remove: {
          description: "Quita un rol de DJ",
          options: {
            role: "El rol"
          }
        },
        list: {
          description: "Lista los roles de DJ"
        }
      }
    },
    botchannel: {
      name: "botchannel",
      description: "Restringe los comandos de m\xFAsica a canales espec\xEDficos",
      subcommands: {
        add: {
          description: "Permite un canal",
          options: {
            channel: "El canal"
          }
        },
        remove: {
          description: "Veta un canal",
          options: {
            channel: "El canal"
          }
        },
        clear: {
          description: "Permite todos los canales"
        }
      }
    },
    defaultvolume: {
      name: "defaultvolume",
      description: "Establece el volumen por defecto de este servidor",
      options: {
        level: "Volumen de 0 a 150"
      }
    },
    idletimeout: {
      name: "idletimeout",
      description: "Establece cu\xE1nto esperar antes de irse al estar inactivo",
      options: {
        minutes: "Minutos, 0 para desactivar"
      }
    },
    help: {
      name: "help",
      description: "Muestra el men\xFA de ayuda"
    },
    ping: {
      name: "ping",
      description: "Muestra la latencia del bot"
    },
    stats: {
      name: "stats",
      description: "Muestra estad\xEDsticas del bot"
    },
    invite: {
      name: "invite",
      description: "Obtiene el enlace de invitaci\xF3n del bot"
    },
    about: {
      name: "about",
      description: "Muestra informaci\xF3n sobre Slux"
    },
    skipto: {
      description: "Salta a una pista concreta de la cola",
      options: {
        index: "Posici\xF3n de la cola a la que saltar"
      }
    },
    removeduplicates: {
      description: "Elimina las pistas duplicadas de la cola"
    },
    sleep: {
      description: "Pausa la reproducci\xF3n tras un tiempo (temporizador)",
      options: {
        minutes: "Minutos hasta la pausa (0 u off para cancelar)"
      }
    },
    nodes: {
      description: "Muestra el estado de los nodos de m\xFAsica"
    },
    developer: {
      description: "Conoce al desarrollador de Slux"
    }
  },
  music: {
    nowPlaying: "Reproduciendo ahora",
    searching: "Buscando...",
    added: "Se a\xF1adi\xF3 **{title}** a la cola",
    addedAt: "Se a\xF1adi\xF3 **{title}** a la posici\xF3n #{position} de la cola",
    addedPlaylist: "Se a\xF1adiaron **{count}** canciones de **{name}** a la cola",
    selectPrompt: "Elige una canci\xF3n \u2014 resultados para `{query}`",
    selectButton: "Elegir",
    cancelButton: "Cancelar",
    paused: "Reproductor en pausa.",
    resumed: "Reproductor reanudado.",
    alreadyPaused: "El reproductor ya est\xE1 en pausa.",
    notPaused: "El reproductor no est\xE1 en pausa.",
    stopped: "Reproductor detenido y canal abandonado.",
    skipped: "Se salt\xF3 **{title}**.",
    noPrevious: "No hay canci\xF3n anterior.",
    previousNow: "Reproduciendo la canci\xF3n anterior.",
    queueTitle: "Cola de {guild}",
    queueNowPlaying: "**Reproduciendo** \u2014 [{title}]({uri}) `{duration}`",
    queueUpNext: "A continuaci\xF3n",
    queueFooter: "{count} canciones \u2022 {duration} en total",
    npLength: "Duraci\xF3n",
    npPosition: "Posici\xF3n",
    npVolume: "Volumen",
    npLoop: "Bucle",
    npFilters: "Filtros",
    live: "EN VIVO",
    stream: "Transmisi\xF3n en vivo",
    removed: "Se elimin\xF3 **{title}** de la cola.",
    invalidIndex: "No hay ninguna canci\xF3n en la posici\xF3n #{index}.",
    cleared: "Cola vaciada ({count} canciones).",
    moved: "Se movi\xF3 **{title}** de #{from} a #{to}.",
    shuffled: "Cola barajada ({count} canciones).",
    loopOff: "El bucle est\xE1 ahora **desactivado**.",
    loopTrack: "Repitiendo la **canci\xF3n actual**.",
    loopQueue: "Repitiendo la **cola**.",
    volumeSet: "Volumen establecido al **{level}%**.",
    volumeCurrent: "El volumen actual es **{level}%**.",
    seeked: "Saltado a **{position}**.",
    seekInvalid: "Posici\xF3n no v\xE1lida \u2014 la canci\xF3n dura solo {length}.",
    forwarded: "Avanzado a **{position}**.",
    rewound: "Retrocedido a **{position}**.",
    joined: " Unido a **{channel}**.",
    joinFailed: "No pude unirme a ese canal de voz.",
    replaying: "Repitiendo la canci\xF3n actual.",
    grabTitle: "Canci\xF3n guardada",
    grabDmed: "Te envi\xE9 la canci\xF3n actual por mensaje directo.",
    grabDmFailed: "No pude enviarte un mensaje directo \u2014 activa los MD de miembros del servidor.",
    lyricsTitle: "Letra de {title}",
    lyricsNone: "No se encontr\xF3 letra para la canci\xF3n actual.",
    autoplayOn: "Reproducci\xF3n autom\xE1tica **activada** \u2014 seguir\xE9 poniendo canciones relacionadas.",
    autoplayOff: "Reproducci\xF3n autom\xE1tica **desactivada**.",
    stayOn: "Modo 24/7 **activado** \u2014 me quedar\xE9 en el canal.",
    stayOff: "Modo 24/7 **desactivado**.",
    djmodeOn: "Modo DJ **activado** \u2014 solo los oyentes del canal de voz pueden controlarme.",
    djmodeOff: "Modo DJ **desactivado**.",
    djmodeActive: "El modo DJ est\xE1 activo \u2014 solo los oyentes del canal de voz pueden controlarme.",
    leftIdle: "Abandon\xE9 el canal por inactividad.",
    leftAlone: "Abandon\xE9 el canal porque todos se fueron.",
    notSeekable: "No se puede saltar en esta canci\xF3n.",
    queueEnded: "La cola ha terminado.",
    pausedLabel: "En pausa",
    addedTitle: "A\xF1adido a la cola",
    addedTopTitle: "A\xF1adido al principio",
    skipPlayTitle: "Saltando a",
    playlistAddedTitle: "Lista a\xF1adida",
    queuePosition: "Posici\xF3n",
    queueTotal: "Cola",
    totalDuration: "Duraci\xF3n total",
    searchResultsTitle: "Resultados de b\xFAsqueda",
    selectFooter: "Elige una pista abajo",
    selectPlaceholder: "Elige una pista\u2026",
    stoppedTitle: "Detenido",
    skippedTitle: "Saltada",
    previousTitle: "Pista anterior",
    queueJumpTo: "Ir a la p\xE1gina\u2026",
    queuePageOption: "P\xE1gina {page}",
    npProgress: "Progreso",
    removedTitle: "Eliminada",
    clearedTitle: "Cola vaciada",
    movedTitle: "Pista movida",
    shuffledTitle: "Aleatorizada",
    loopTitle: "Modo de repetici\xF3n",
    loopCurrent: "El modo de repetici\xF3n es {mode}",
    loopModeOff: "Off",
    loopModeTrack: "Pista",
    loopModeQueue: "Cola",
    volumeTitle: "Volumen",
    volDown: "Volumen \u221210",
    volUp: "Volumen +10",
    volMute: "Silenciar",
    pausedTitle: "En pausa",
    resumedTitle: "Reanudado",
    seekedTitle: "Posici\xF3n cambiada",
    forwardedTitle: "Adelantado",
    rewoundTitle: "Rebobinado",
    replayingTitle: "Reproduciendo de nuevo",
    joinedTitle: "Conectado",
    grabSource: "Fuente",
    lyricsSynced: "Sincronizada",
    lyricsPlain: "Simple",
    autoplayLabel: "Reproducci\xF3n autom\xE1tica",
    djmodeLabel: "Modo DJ",
    ctrlPrevious: "Anterior",
    ctrlPause: "Pausa",
    ctrlResume: "Reanudar",
    ctrlSkip: "Saltar",
    ctrlLoop: "Bucle",
    ctrlStop: "Detener",
    ctrlShuffle: "Aleatorio",
    ctrlQueue: "Cola",
    ctrlLyrics: "Letra",
    ctrlVolDown: "Vol \u221210",
    ctrlVolUp: "Vol +10",
    engineNotReady: "El motor de m\xFAsica no est\xE1 conectado todav\xEDa \u2014 Lavalink a\xFAn est\xE1 arrancando o no es accesible. Int\xE9ntalo de nuevo en un minuto (revisa la consola del bot).",
    skiptoTitle: "Saltado a la pista",
    skiptoDone: "Salt\xE9 directamente a la posici\xF3n {index} \u2014 todo lo anterior fue descartado.",
    removedDuplicatesTitle: "Duplicados eliminados",
    removedDuplicates: "Se eliminaron **{count}** pista(s) duplicada(s) de la cola.",
    noDuplicates: "No hay pistas duplicadas \u2014 \xA1tu cola est\xE1 limpia!",
    sleepTitle: "Temporizador",
    sleepSet: "Pausar\xE9 la reproducci\xF3n en {minutes} minuto(s).",
    sleepCancelled: "Temporizador cancelado.",
    sleepStatus: "La reproducci\xF3n se pausa en {minutes} minuto(s).",
    sleepNone: "No hay temporizador. Usa `sleep <minutos>` para programarlo."
  },
  playlists: {
    created: "Lista **{name}** creada.",
    deleted: "Lista **{name}** eliminada.",
    renamed: "Lista **{old}** renombrada a **{new}**.",
    notFound: "No tienes una lista llamada **{name}**.",
    exists: "Ya tienes una lista llamada **{name}**.",
    nameTooLong: "Los nombres de lista pueden tener como m\xE1ximo 64 caracteres.",
    addedTracks: "Se a\xF1adiaron **{count}** canciones a **{name}**.",
    addedCurrent: "Se a\xF1adi\xF3 **{title}** a **{name}**.",
    noCurrent: "No se est\xE1 reproduciendo nada \u2014 indica un nombre o URL.",
    removedTrack: "Se elimin\xF3 **{title}** de **{name}**.",
    listTitle: "Tus listas de reproducci\xF3n",
    listEmpty: "A\xFAn no tienes listas de reproducci\xF3n.",
    infoTitle: "Lista: {name}",
    infoFooter: "{count} canciones \u2022 {duration} \u2022 {visibility}",
    public: "P\xFAblica",
    private: "Privada",
    loaded: "Se cargaron **{count}** canciones de **{name}**.",
    empty: "La lista **{name}** est\xE1 vac\xEDa.",
    limitReached: "Las listas pueden contener como m\xE1ximo {limit} canciones.",
    tooManyToAdd: "Eso superar\xEDa el l\xEDmite de {limit} canciones de la lista.",
    favorites: "Favoritos",
    favoritesEmpty: "A\xFAn no tienes favoritos.",
    favoritesAdded: "**{title}** a\xF1adido a tus favoritos.",
    favoritesRemoved: "**{title}** eliminado de tus favoritos.",
    favoritesLoaded: "Se cargaron **{count}** favoritos.",
    owner: "Propietario",
    createdTitle: "Lista creada",
    deletedTitle: "Lista eliminada",
    renamedTitle: "Lista renombrada",
    addedTitle: "Pista a\xF1adida",
    removedTrackTitle: "Pista eliminada",
    visibilityTitle: "Visibilidad cambiada",
    loadedTitle: "Lista cargada",
    savedQueueTitle: "Cola guardada",
    savedQueue: "Se guard\xF3 la cola actual ({count} pistas) en la playlist **{name}**.",
    savedQueueUpdated: "Se actualiz\xF3 la playlist **{name}** con la cola actual ({count} pistas).",
    nothingToSave: "No suena nada \u2014 no hay cola que guardar."
  },
  filters: {
    applied: "Filtro **{name}** aplicado.",
    removed: "Filtro **{name}** desactivado.",
    reset: "Se restablecieron todos los filtros.",
    listTitle: "Filtros activos",
    listNone: "No hay filtros activos.",
    invalidLevel: "El nivel debe ser: low, medium, high o insane.",
    invalidValue: "El valor debe estar entre {min} y {max}.",
    eqApplied: "Ecualizador personalizado aplicado.",
    eqUsage: "Uso: `{prefix}eq <15 ganancias de -1 a 1>` \u2014 p. ej. `{prefix}eq 0.3 0.3 0.2 0 -0.2 0 0 0 0 0 0 0 0 0 0`",
    appliedTitle: "Filtro aplicado",
    removedTitle: "Filtro quitado",
    resetTitle: "Filtros restablecidos",
    resetAll: "Restablecer filtros",
    openPanel: "Panel de filtros",
    panelTitle: "Filtros de audio",
    panelHint: "Elige un filtro para activarlo o desactivarlo \u2014 los cambios son instant\xE1neos.",
    pickPlaceholder: "Activa un filtro\u2026",
    stateOn: "S\xCD \u2014 selecci\xF3nalo para desactivar",
    stateOff: "NO \u2014 selecci\xF3nalo para activar"
  },
  settings: {
    "247": "24/7 por defecto",
    title: "Configuraci\xF3n de {guild}",
    prefix: "Prefijo",
    language: "Idioma",
    djRoles: "Roles de DJ",
    botChannels: "Canales permitidos",
    defaultVolume: "Volumen por defecto",
    autoplay: "Autoplay por defecto",
    idleTimeout: "Tiempo de inactividad",
    allChannels: "Todos los canales",
    noTimeout: "Desactivado",
    prefixSet: "Prefijo establecido a `{prefix}`.",
    prefixInvalid: "El prefijo debe tener 1-5 caracteres y no contener espacios.",
    languageSet: "Idioma establecido a **{language}**.",
    languageInvalid: "Idiomas disponibles: {languages}.",
    djRoleAdded: "**{role}** ahora es un rol de DJ.",
    djRoleRemoved: "**{role}** ya no es un rol de DJ.",
    djRoleNotSet: "**{role}** no es un rol de DJ.",
    djRoleList: "Roles de DJ: {roles}",
    djRoleNone: "No hay roles de DJ establecidos.",
    botChannelAdded: "Los comandos de m\xFAsica ahora se restringen a **{channel}**.",
    botChannelRemoved: "**{channel}** fue eliminado de los canales permitidos.",
    botChannelNotSet: "**{channel}** no est\xE1 en los canales permitidos.",
    botChannelCleared: "Los comandos de m\xFAsica ahora se permiten en todos los canales.",
    defaultVolumeSet: "Volumen por defecto establecido al **{level}%**.",
    idleTimeoutSet: "Tiempo de inactividad establecido a **{minutes}** minutos.",
    idleTimeoutDisabled: "Tiempo de inactividad desactivado \u2014 me quedar\xE9 hasta que me detengan."
  },
  info: {
    helpTitle: "Slux \u2014 Ayuda",
    helpDescription: "Un bot de m\xFAsica lleno de funciones. Usa comandos de barra o `{prefix}` como prefijo.",
    helpFields: {
      music: "M\xFAsica",
      playlists: "Listas",
      filters: "Filtros",
      settings: "Configuraci\xF3n",
      info: "Informaci\xF3n"
    },
    helpFooter: "Ver todos los comandos en el panel",
    pingTitle: "\xA1Pong!",
    pingWebsocket: "Websocket",
    pingRoundtrip: "Ida y vuelta",
    pingLavalink: "Lavalink",
    statsTitle: "Slux \u2014 Estad\xEDsticas",
    statsServers: "Servidores",
    statsPlayers: "Reproductores activos",
    statsUsers: "Usuarios",
    statsUptime: "Tiempo activo",
    statsMemory: "Memoria",
    statsNode: "Nodo Lavalink",
    statsNodePenalties: "Penalizaciones del nodo",
    inviteTitle: "Invitar a Slux",
    inviteDescription: "Haz clic en el bot\xF3n de abajo para a\xF1adir Slux a tu servidor.",
    aboutTitle: "Sobre Slux",
    aboutDescription: "Slux es un bot de m\xFAsica de Discord gratuito y lleno de funciones con Spotify, YouTube, SoundCloud, Deezer, Apple Music y m\xE1s \u2014 con un panel web en tiempo real.",
    aboutFooter: "Hecho con \u2665 \u2014 gratis para siempre, sin niveles premium",
    helpPickCategory: "Elige una categor\xEDa de comandos\u2026",
    helpCategoryCount: "{count} comandos",
    helpAndMore: "+{count} m\xE1s",
    helpCommandsTitle: "Comandos",
    pingStatus: "Estado de la conexi\xF3n",
    inviteButton: "Invitar a Slux",
    dashboardButton: "Abrir panel",
    aboutSources: "Fuentes",
    aboutFeatures: "Destacados",
    nodesTitle: "Nodos de m\xFAsica",
    nodesActive: "Nodo activo: {name}",
    nodeConnected: "Conectado",
    nodeConnecting: "Conectando\u2026",
    nodeDisconnecting: "Desconectando\u2026",
    nodeDisconnected: "Desconectado",
    nodePlayers: "Reproductores",
    nodeCpu: "CPU",
    developerTitle: "Hecho por SHM",
    developerDescription: "Slux est\xE1 dise\xF1ado, construido y mantenido por **SHM**. Cada funci\xF3n \u2014 el motor de reproducci\xF3n, los filtros, el panel y las letras \u2014 est\xE1 hecha con cari\xF1o.",
    developerRole: "Creador y desarrollador",
    developerWorkTitle: "El proyecto",
    developerWork: "Sigue a **@Letzforge** en YouTube para v\xEDdeos de construcci\xF3n, dev logs y tutoriales de proyectos como este.",
    developerFooter: "Hecho con \u2764\uFE0F por SHM"
  },
  dashboard: {
    nav: {
      player: "Reproductor",
      settings: "Configuraci\xF3n",
      playlists: "Listas",
      backToSite: "Volver al sitio",
      logout: "Cerrar sesi\xF3n",
      dashboard: "Panel",
      commands: "Comandos",
      theme: "Tema"
    },
    landing: {
      badge: "Gratis para siempre \u2014 sin premium",
      title: "M\xFAsica que nunca pierde el ritmo",
      subtitle: "Slux es un bot de m\xFAsica de Discord lleno de funciones con soporte para Spotify, YouTube, SoundCloud, Deezer y Apple Music \u2014 adem\xE1s de un panel en tiempo real para controlarlo todo desde tu navegador.",
      addDiscord: "A\xF1adir a Discord",
      openDashboard: "Abrir panel",
      featuresTitle: "Todo lo que necesitas",
      featuresSubtitle: "Todas las funciones, gratis para todos. Esa es la promesa de Slux.",
      sourcesTitle: "Todas tus fuentes",
      sourcesDescription: "Busca y reproduce desde Spotify, YouTube, SoundCloud, Deezer, Apple Music, Tidal y YouTube Music.",
      filtersTitle: "Filtros de estudio",
      filtersDescription: "Bassboost, nightcore, vaporwave, 8D, karaoke y un ecualizador completo de 15 bandas.",
      playlistsTitle: "Listas potentes",
      playlistsDescription: "Guarda tus canciones favoritas, importa listas y c\xE1rgalas con un solo comando.",
      lyricsTitle: "Letras sincronizadas",
      lyricsDescription: "Sigue la letra en Discord o en el panel con letras sincronizadas.",
      dashboardTitle: "Panel en tiempo real",
      dashboardDescription: "Controla la reproducci\xF3n, gestiona la cola y configura el bot desde tu navegador.",
      autoplayTitle: "Autoplay y 24/7",
      autoplayDescription: "Slux mantiene la m\xFAsica con canciones relacionadas y puede quedarse en el canal todo el d\xEDa.",
      i18nTitle: "Habla tu idioma",
      i18nDescription: "Ingl\xE9s, hindi, espa\xF1ol, franc\xE9s, alem\xE1n y portugu\xE9s de serie.",
      statsServers: "servidores",
      statsPlayers: "reproductores activos",
      statsTracks: "canciones reproducidas",
      ctaTitle: "\xBFListo para mejorar el sonido de tu servidor?",
      ctaSubtitle: "A\xF1ade Slux en menos de un minuto. Sin configuraci\xF3n, sin premium, sin l\xEDmites."
    },
    commands: {
      title: "Comandos",
      subtitle: "Todo lo que Slux puede hacer \u2014 en {count} comandos",
      search: "Buscar comandos...",
      noResults: "Ning\xFAn comando coincide con tu b\xFAsqueda.",
      usage: "Uso"
    },
    guilds: {
      title: "Tus servidores",
      subtitle: "Elige un servidor para gestionarlo",
      invite: "Invitar",
      manage: "Gestionar",
      empty: "No se encontraron servidores con permiso de Administrar servidor."
    },
    settings: {
      title: "Configuraci\xF3n",
      general: "General",
      playback: "Reproducci\xF3n",
      dj: "DJ",
      prefix: "Prefijo de comandos",
      prefixDescription: "Prefijo para comandos de texto",
      language: "Idioma",
      languageDescription: "Idioma de las respuestas del bot",
      defaultVolume: "Volumen por defecto",
      defaultVolumeDescription: "Volumen al iniciar el reproductor",
      autoplay: "Autoplay",
      autoplayDescription: "Seguir reproduciendo canciones relacionadas al terminar la cola",
      stay247: "Modo 24/7",
      stay247Description: "Quedarse en el canal de voz al estar solo o inactivo",
      idleTimeout: "Tiempo de inactividad",
      idleTimeoutDescription: "Irse tras estos minutos de inactividad (0 = nunca)",
      djRoles: "Roles de DJ",
      djRolesDescription: "Roles que pueden usar comandos de DJ",
      botChannels: "Canales permitidos",
      botChannelsDescription: "Restringir los comandos de m\xFAsica a estos canales",
      allChannels: "Todos los canales permitidos",
      save: "Guardar cambios",
      saved: "Configuraci\xF3n guardada",
      saveFailed: "Error al guardar la configuraci\xF3n",
      notAvailable: "Servidor no disponible \u2014 \xBFest\xE1 el bot en \xE9l?"
    },
    player: {
      title: "Reproductor",
      notConnected: "No conectado",
      notConnectedDescription: "Slux no est\xE1 en un canal de voz. Elige un canal para empezar a escuchar.",
      join: "Unirse al canal",
      nowPlaying: "Reproduciendo ahora",
      nothingPlaying: "Nada suena",
      queue: "Cola",
      queueEmpty: "La cola est\xE1 vac\xEDa \u2014 \xA1busca algo!",
      lyrics: "Letra",
      noLyrics: "No hay letra disponible para esta canci\xF3n.",
      searchPlaceholder: "Busca o pega un enlace...",
      play: "Reproducir",
      pause: "Pausar",
      resume: "Reanudar",
      previous: "Anterior",
      skip: "Saltar",
      stop: "Detener",
      shuffle: "Barajar",
      loop: "Bucle",
      volume: "Volumen",
      autoplay: "Autoplay",
      clear: "Vaciar cola",
      remove: "Eliminar",
      moveTop: "Mover arriba",
      added: "A\xF1adido a la cola",
      live: "EN VIVO",
      lyricsSynced: "Sincronizada",
      lyricsPlain: "Simple",
      autoScroll: "Auto-desplazamiento",
      history: "Historial",
      historyEmpty: "El historial est\xE1 vac\xEDo.",
      replay: "Reproducir de nuevo",
      filtersTab: "Filtros",
      filtersNone: "No hay filtros activos.",
      filtersReset: "Restablecer filtros",
      seekHint: "Arrastra para buscar",
      requestedBy: "Pedida por",
      playingIn: "Sonando en",
      realtimeOff: "Tiempo real desconectado"
    },
    playlists: {
      title: "Tus listas",
      subtitle: "Tus colecciones guardadas, disponibles en cualquier servidor",
      create: "Nueva lista",
      createTitle: "Crear una lista",
      namePlaceholder: "Nombre de la lista",
      descriptionPlaceholder: "Descripci\xF3n (opcional)",
      createCta: "Crear",
      delete: "Eliminar lista",
      deleteConfirm: '\xBFEliminar la lista "{name}"? Esto no se puede deshacer.',
      public: "P\xFAblica",
      private: "Privada",
      tracks: "canciones",
      empty: "A\xFAn no hay listas \u2014 \xA1crea la primera!",
      loadToGuild: "Reproducir en un servidor",
      removeTrack: "Eliminar canci\xF3n",
      created: "Lista creada",
      deleted: "Lista eliminada",
      emptyPlaylist: "Esta lista est\xE1 vac\xEDa."
    },
    auth: {
      login: "Iniciar sesi\xF3n con Discord",
      loginRequired: "Inicio de sesi\xF3n requerido",
      loginRequiredDescription: "Necesitas iniciar sesi\xF3n con Discord para acceder al panel."
    },
    user: {
      loggedInAs: "Sesi\xF3n iniciada como"
    }
  }
};

// src/i18n/locales/fr.json
var fr_default = {
  common: {
    error: "Une erreur s'est produite. Veuillez r\xE9essayer.",
    noVoiceChannel: "Vous devez d'abord rejoindre un salon vocal.",
    noPlayer: "Rien n'est en cours de lecture.",
    notInSameVoice: "Vous devez \xEAtre dans le m\xEAme salon vocal que moi.",
    queueEmpty: "La file d'attente est vide.",
    cancelled: "Annul\xE9.",
    timeUp: "Temps \xE9coul\xE9.",
    djRequired: "Vous avez besoin d'un r\xF4le DJ ou de la permission G\xE9rer les salons pour utiliser cette commande.",
    manageGuildRequired: "Vous avez besoin de la permission G\xE9rer le serveur pour utiliser cette commande.",
    blacklisted: "Vous n'\xEAtes pas autoris\xE9 \xE0 utiliser ce bot.",
    nothingFound: "Aucun r\xE9sultat pour cette recherche.",
    invalidNumber: "Veuillez fournir un nombre valide.",
    page: "Page {current}/{total}",
    requestedBy: "Demand\xE9 par {user}",
    unknownCommand: "Commande inconnue. Essayez `{prefix}help`.",
    yes: "Oui",
    no: "Non",
    enabled: "Activ\xE9",
    disabled: "D\xE9sactiv\xE9",
    none: "Aucun",
    minutes: "minutes",
    tracks: "morceaux",
    errorTitle: "Erreur",
    doneTitle: "Termin\xE9",
    warnTitle: "Attention",
    on: "OUI",
    off: "NON",
    commands: "commandes",
    viewExpired: "Cette vue a expir\xE9 \u2014 relancez la commande.",
    cooldown: "Vous utilisez les commandes trop vite \u2014 r\xE9essayez dans quelques secondes.",
    channelNotAllowed: "Les commandes ne sont pas autoris\xE9es dans ce salon.",
    mentionHelp: {
      title: "Salut, je suis Slux !",
      description: "Le bot musical de votre serveur \u2014 recherche, file, paroles, filtres et un tableau de bord web. Voici comment m'utiliser :",
      prefixField: "Pr\xE9fixe ici",
      prefixValue: "Utilisez {prefix} avant les commandes, p. ex. {prefix}play",
      slashField: "Commandes slash",
      slashValue: "Tapez `/` n'importe o\xF9 et choisissez une commande.",
      popularField: "Commandes populaires",
      tipField: "Astuce",
      tipValue: "Mentionnez-moi \xE0 tout moment pour revoir ce message, ou utilisez {prefix}help pour la liste compl\xE8te.",
      commandsButton: "Toutes les commandes",
      dashboardButton: "Tableau de bord",
      inviteButton: "M'inviter"
    }
  },
  commands: {
    "247": {
      name: "247",
      description: "Activer/d\xE9sactiver le mode rester 24/7"
    },
    play: {
      name: "play",
      description: "Lire une chanson, une playlist ou une recherche",
      options: {
        query: "Nom de la chanson, URL ou lien de playlist"
      }
    },
    playnext: {
      name: "playnext",
      description: "Ajouter une chanson \xE0 lire juste apr\xE8s l'actuelle",
      options: {
        query: "Nom de la chanson ou URL"
      }
    },
    playtop: {
      name: "playtop",
      description: "Ajouter une chanson en haut de la file",
      options: {
        query: "Nom de la chanson ou URL"
      }
    },
    playskip: {
      name: "playskip",
      description: "Ajouter une chanson en haut et y passer imm\xE9diatement",
      options: {
        query: "Nom de la chanson ou URL"
      }
    },
    pause: {
      name: "pause",
      description: "Mettre en pause la chanson actuelle"
    },
    resume: {
      name: "resume",
      description: "Reprendre la chanson en pause"
    },
    stop: {
      name: "stop",
      description: "Arr\xEAter la lecture, vider la file et partir"
    },
    skip: {
      name: "skip",
      description: "Passer la chanson actuelle"
    },
    previous: {
      name: "previous",
      description: "Lire la chanson pr\xE9c\xE9dente de l'historique"
    },
    seek: {
      name: "seek",
      description: "Aller \xE0 une position dans la chanson actuelle",
      options: {
        position: "Position comme 1:30, 90 ou 1m30s"
      }
    },
    forward: {
      name: "forward",
      description: "Avancer d'un nombre de secondes",
      options: {
        seconds: "Secondes \xE0 avancer"
      }
    },
    rewind: {
      name: "rewind",
      description: "Reculer d'un nombre de secondes",
      options: {
        seconds: "Secondes \xE0 reculer"
      }
    },
    queue: {
      name: "queue",
      description: "Afficher la file d'attente actuelle",
      options: {
        page: "Num\xE9ro de page"
      }
    },
    nowplaying: {
      name: "nowplaying",
      description: "Afficher la chanson en cours"
    },
    remove: {
      name: "remove",
      description: "Retirer une chanson de la file",
      options: {
        index: "La position \xE0 retirer"
      }
    },
    clear: {
      name: "clear",
      description: "Vider toute la file d'attente"
    },
    move: {
      name: "move",
      description: "D\xE9placer une chanson dans la file",
      options: {
        from: "Position d'origine",
        to: "Position de destination"
      }
    },
    shuffle: {
      name: "shuffle",
      description: "M\xE9langer la file d'attente"
    },
    loop: {
      name: "loop",
      description: "D\xE9finir le mode de r\xE9p\xE9tition",
      options: {
        mode: "Mode : off, track ou queue"
      }
    },
    volume: {
      name: "volume",
      description: "D\xE9finir ou afficher le volume",
      options: {
        level: "Volume de 0 \xE0 150"
      }
    },
    join: {
      name: "join",
      description: "Rejoindre votre salon vocal"
    },
    replay: {
      name: "replay",
      description: "Rejouer la chanson actuelle depuis le d\xE9but"
    },
    grab: {
      name: "grab",
      description: "Recevoir la chanson actuelle en message priv\xE9"
    },
    search: {
      name: "search",
      description: "Rechercher des chansons et en choisir une",
      options: {
        query: "Que rechercher"
      }
    },
    lyrics: {
      name: "lyrics",
      description: "Afficher les paroles de la chanson actuelle"
    },
    autoplay: {
      name: "autoplay",
      description: "Activer/d\xE9sactiver la lecture automatique"
    },
    djmode: {
      name: "djmode",
      description: "Mode DJ : seuls les membres vocaux contr\xF4lent le bot"
    },
    playlist: {
      name: "playlist",
      description: "G\xE9rer vos playlists",
      subcommands: {
        create: {
          description: "Cr\xE9er une nouvelle playlist",
          options: {
            name: "Nom de la playlist"
          }
        },
        delete: {
          description: "Supprimer une de vos playlists",
          options: {
            name: "Nom de la playlist"
          }
        },
        rename: {
          description: "Renommer une playlist",
          options: {
            old: "Nom actuel",
            new: "Nouveau nom"
          }
        },
        add: {
          description: "Ajouter une chanson ou un lien \xE0 une playlist",
          options: {
            name: "Nom de la playlist",
            query: "Chanson ou URL"
          }
        },
        remove: {
          description: "Retirer un morceau par position",
          options: {
            name: "Nom de la playlist",
            index: "Position du morceau"
          }
        },
        list: {
          description: "Lister vos playlists"
        },
        info: {
          description: "Afficher les morceaux d'une playlist",
          options: {
            name: "Nom de la playlist"
          }
        },
        load: {
          description: "Charger une playlist dans la file",
          options: {
            name: "Nom de la playlist"
          }
        },
        public: {
          description: "Basculer une playlist entre publique et priv\xE9e",
          options: {
            name: "Nom de la playlist"
          }
        },
        save: {
          description: "Enregistre la file actuelle en playlist",
          options: {
            name: "Nom de la playlist"
          }
        }
      }
    },
    favorites: {
      name: "favorites",
      description: "G\xE9rer vos chansons favorites",
      subcommands: {
        add: {
          description: "Ajouter la chanson actuelle ou une recherche aux favoris",
          options: {
            query: "Nom ou URL (vide = chanson actuelle)"
          }
        },
        remove: {
          description: "Retirer un favori par position",
          options: {
            index: "Position du favori"
          }
        },
        list: {
          description: "Lister vos favoris"
        },
        play: {
          description: "Lire vos favoris"
        }
      }
    },
    bassboost: {
      name: "bassboost",
      description: "Activer/d\xE9sactiver le filtre bassboost",
      options: {
        level: "Niveau : low, medium, high ou insane"
      }
    },
    nightcore: {
      name: "nightcore",
      description: "Activer/d\xE9sactiver le filtre nightcore"
    },
    vaporwave: {
      name: "vaporwave",
      description: "Activer/d\xE9sactiver le filtre vaporwave"
    },
    soft: {
      name: "soft",
      description: "Activer/d\xE9sactiver le filtre soft"
    },
    "8d": {
      name: "8d",
      description: "Activer/d\xE9sactiver le filtre audio 8D"
    },
    karaoke: {
      name: "karaoke",
      description: "Activer/d\xE9sactiver le filtre karaok\xE9"
    },
    tremolo: {
      name: "tremolo",
      description: "Activer/d\xE9sactiver le filtre tremolo"
    },
    vibrato: {
      name: "vibrato",
      description: "Activer/d\xE9sactiver le filtre vibrato"
    },
    distortion: {
      name: "distortion",
      description: "Activer/d\xE9sactiver le filtre distortion"
    },
    lowpass: {
      name: "lowpass",
      description: "Activer/d\xE9sactiver le filtre lowpass"
    },
    speed: {
      name: "speed",
      description: "D\xE9finir la vitesse de lecture",
      options: {
        value: "Vitesse de 0.5 \xE0 5.0"
      }
    },
    pitch: {
      name: "pitch",
      description: "D\xE9finir la hauteur",
      options: {
        value: "Hauteur de 0.5 \xE0 5.0"
      }
    },
    eq: {
      name: "eq",
      description: "D\xE9finir un \xE9galiseur personnalis\xE9 comme 3 0 0 1 0 -1",
      options: {
        bands: "15 gains de -1 \xE0 1"
      }
    },
    filters: {
      name: "filters",
      description: "Afficher les filtres actifs"
    },
    filtersreset: {
      name: "reset",
      description: "R\xE9initialiser tous les filtres"
    },
    settings: {
      name: "settings",
      description: "Afficher les param\xE8tres du serveur"
    },
    prefix: {
      name: "prefix",
      description: "D\xE9finir le pr\xE9fixe de commandes de ce serveur",
      options: {
        prefix: "Nouveau pr\xE9fixe, jusqu'\xE0 5 caract\xE8res"
      }
    },
    language: {
      name: "language",
      description: "D\xE9finir la langue du bot pour ce serveur",
      options: {
        language: "Langue \xE0 utiliser"
      }
    },
    djrole: {
      name: "djrole",
      description: "G\xE9rer les r\xF4les DJ",
      subcommands: {
        add: {
          description: "Ajouter un r\xF4le DJ",
          options: {
            role: "Le r\xF4le"
          }
        },
        remove: {
          description: "Retirer un r\xF4le DJ",
          options: {
            role: "Le r\xF4le"
          }
        },
        list: {
          description: "Lister les r\xF4les DJ"
        }
      }
    },
    botchannel: {
      name: "botchannel",
      description: "Restreindre les commandes musicales \xE0 certains salons",
      subcommands: {
        add: {
          description: "Autoriser un salon",
          options: {
            channel: "Le salon"
          }
        },
        remove: {
          description: "Interdire un salon",
          options: {
            channel: "Le salon"
          }
        },
        clear: {
          description: "Autoriser tous les salons"
        }
      }
    },
    defaultvolume: {
      name: "defaultvolume",
      description: "D\xE9finir le volume par d\xE9faut de ce serveur",
      options: {
        level: "Volume de 0 \xE0 150"
      }
    },
    idletimeout: {
      name: "idletimeout",
      description: "D\xE9finir le d\xE9lai avant de partir en cas d'inactivit\xE9",
      options: {
        minutes: "Minutes, 0 pour d\xE9sactiver"
      }
    },
    help: {
      name: "help",
      description: "Afficher le menu d'aide"
    },
    ping: {
      name: "ping",
      description: "Afficher la latence du bot"
    },
    stats: {
      name: "stats",
      description: "Afficher les statistiques du bot"
    },
    invite: {
      name: "invite",
      description: "Obtenir le lien d'invitation du bot"
    },
    about: {
      name: "about",
      description: "Afficher des informations sur Slux"
    },
    skipto: {
      description: "Passer directement \xE0 une piste de la file",
      options: {
        index: "Position de la file o\xF9 sauter"
      }
    },
    removeduplicates: {
      description: "Retire les pistes en double de la file"
    },
    sleep: {
      description: "Met la lecture en pause apr\xE8s un d\xE9lai (minuterie)",
      options: {
        minutes: "Minutes avant la pause (0 ou off pour annuler)"
      }
    },
    nodes: {
      description: "Affiche l'\xE9tat des n\u0153uds musicaux"
    },
    developer: {
      description: "D\xE9couvrez le d\xE9veloppeur de Slux"
    }
  },
  music: {
    nowPlaying: "En cours de lecture",
    searching: "Recherche...",
    added: "**{title}** ajout\xE9 \xE0 la file d'attente",
    addedAt: "**{title}** ajout\xE9 \xE0 la position #{position} de la file",
    addedPlaylist: "**{count}** morceaux de **{name}** ajout\xE9s \xE0 la file",
    selectPrompt: "Choisissez un morceau \u2014 r\xE9sultats pour `{query}`",
    selectButton: "Choisir",
    cancelButton: "Annuler",
    paused: "Lecteur mis en pause.",
    resumed: "Lecture reprise.",
    alreadyPaused: "Le lecteur est d\xE9j\xE0 en pause.",
    notPaused: "Le lecteur n'est pas en pause.",
    stopped: "Lecteur arr\xEAt\xE9 et salon quitt\xE9.",
    skipped: "**{title}** pass\xE9.",
    noPrevious: "Il n'y a pas de chanson pr\xE9c\xE9dente.",
    previousNow: "Lecture de la chanson pr\xE9c\xE9dente.",
    queueTitle: "File d'attente de {guild}",
    queueNowPlaying: "**En lecture** \u2014 [{title}]({uri}) `{duration}`",
    queueUpNext: "\xC0 suivre",
    queueFooter: "{count} morceaux \u2022 {duration} au total",
    npLength: "Dur\xE9e",
    npPosition: "Position",
    npVolume: "Volume",
    npLoop: "Boucle",
    npFilters: "Filtres",
    live: "EN DIRECT",
    stream: "Flux en direct",
    removed: "**{title}** retir\xE9 de la file d'attente.",
    invalidIndex: "Il n'y a pas de morceau \xE0 la position #{index}.",
    cleared: "File d'attente vid\xE9e ({count} morceaux).",
    moved: "**{title}** d\xE9plac\xE9 de #{from} \xE0 #{to}.",
    shuffled: "File d'attente m\xE9lang\xE9e ({count} morceaux).",
    loopOff: "La r\xE9p\xE9tition est maintenant **d\xE9sactiv\xE9e**.",
    loopTrack: "R\xE9p\xE9tition du **morceau actuel**.",
    loopQueue: "R\xE9p\xE9tition de la **file d'attente**.",
    volumeSet: "Volume r\xE9gl\xE9 sur **{level}%**.",
    volumeCurrent: "Le volume est actuellement \xE0 **{level}%**.",
    seeked: "D\xE9plac\xE9 \xE0 **{position}**.",
    seekInvalid: "Position invalide \u2014 la chanson dure seulement {length}.",
    forwarded: "Avanc\xE9 \xE0 **{position}**.",
    rewound: "Recul\xE9 \xE0 **{position}**.",
    joined: "A rejoint **{channel}**.",
    joinFailed: "Je n'ai pas pu rejoindre ce salon vocal.",
    replaying: "Relecture de la chanson actuelle.",
    grabTitle: "Chanson r\xE9cup\xE9r\xE9e",
    grabDmed: "Je vous ai envoy\xE9 la chanson actuelle en message priv\xE9.",
    grabDmFailed: "Je n'ai pas pu vous envoyer de MP \u2014 activez les MP des membres du serveur.",
    lyricsTitle: "Paroles de {title}",
    lyricsNone: "Aucune parole trouv\xE9e pour la chanson actuelle.",
    autoplayOn: "Lecture automatique **activ\xE9e** \u2014 je continuerai \xE0 jouer des titres similaires.",
    autoplayOff: "Lecture automatique **d\xE9sactiv\xE9e**.",
    stayOn: "Mode 24/7 **activ\xE9** \u2014 je resterai dans le salon.",
    stayOff: "Mode 24/7 **d\xE9sactiv\xE9**.",
    djmodeOn: "Mode DJ **activ\xE9** \u2014 seuls les auditeurs du salon vocal peuvent me contr\xF4ler.",
    djmodeOff: "Mode DJ **d\xE9sactiv\xE9**.",
    djmodeActive: "Le mode DJ est actif \u2014 seuls les auditeurs du salon vocal peuvent me contr\xF4ler.",
    leftIdle: "Salon quitt\xE9 pour inactivit\xE9.",
    leftAlone: "Salon quitt\xE9 car tout le monde est parti.",
    notSeekable: "Impossible de se d\xE9placer dans ce morceau.",
    queueEnded: "La file d'attente est termin\xE9e.",
    pausedLabel: "En pause",
    addedTitle: "Ajout\xE9 \xE0 la file",
    addedTopTitle: "Ajout\xE9 en haut",
    skipPlayTitle: "Passage \xE0",
    playlistAddedTitle: "Playlist ajout\xE9e",
    queuePosition: "Position",
    queueTotal: "File",
    totalDuration: "Dur\xE9e totale",
    searchResultsTitle: "R\xE9sultats de recherche",
    selectFooter: "Choisissez une piste ci-dessous",
    selectPlaceholder: "Choisissez une piste\u2026",
    stoppedTitle: "Arr\xEAt\xE9",
    skippedTitle: "Pass\xE9e",
    previousTitle: "Piste pr\xE9c\xE9dente",
    queueJumpTo: "Aller \xE0 la page\u2026",
    queuePageOption: "Page {page}",
    npProgress: "Progression",
    removedTitle: "Retir\xE9e",
    clearedTitle: "File vid\xE9e",
    movedTitle: "Piste d\xE9plac\xE9e",
    shuffledTitle: "M\xE9lang\xE9e",
    loopTitle: "Mode r\xE9p\xE9tition",
    loopCurrent: "Le mode r\xE9p\xE9tition est {mode}",
    loopModeOff: "Off",
    loopModeTrack: "Piste",
    loopModeQueue: "File",
    volumeTitle: "Volume",
    volDown: "Volume \u221210",
    volUp: "Volume +10",
    volMute: "Muet",
    pausedTitle: "En pause",
    resumedTitle: "Repris",
    seekedTitle: "Position chang\xE9e",
    forwardedTitle: "Avanc\xE9",
    rewoundTitle: "Rembobin\xE9",
    replayingTitle: "Relecture",
    joinedTitle: "Connect\xE9",
    grabSource: "Source",
    lyricsSynced: "Synchronis\xE9es",
    lyricsPlain: "Brutes",
    autoplayLabel: "Lecture auto",
    djmodeLabel: "Mode DJ",
    ctrlPrevious: "Pr\xE9c\xE9dent",
    ctrlPause: "Pause",
    ctrlResume: "Reprendre",
    ctrlSkip: "Passer",
    ctrlLoop: "Boucle",
    ctrlStop: "Arr\xEAter",
    ctrlShuffle: "Al\xE9atoire",
    ctrlQueue: "File",
    ctrlLyrics: "Paroles",
    ctrlVolDown: "Vol \u221210",
    ctrlVolUp: "Vol +10",
    engineNotReady: "Le moteur musical n'est pas encore connect\xE9 \u2014 Lavalink d\xE9marre encore ou est injoignable. R\xE9essayez dans une minute (consultez la console du bot).",
    skiptoTitle: "Pass\xE9 \xE0 la piste",
    skiptoDone: "Saut\xE9 directement \xE0 la position {index} \u2014 tout ce qui pr\xE9c\xE9dait a \xE9t\xE9 retir\xE9.",
    removedDuplicatesTitle: "Doublons retir\xE9s",
    removedDuplicates: "**{count}** piste(s) en double retir\xE9e(s) de la file.",
    noDuplicates: "Aucune piste en double \u2014 votre file est propre !",
    sleepTitle: "Minuterie",
    sleepSet: "Je mettrai la lecture en pause dans {minutes} minute(s).",
    sleepCancelled: "Minuterie annul\xE9e.",
    sleepStatus: "La lecture se met en pause dans {minutes} minute(s).",
    sleepNone: "Aucune minuterie d\xE9finie. Utilisez `sleep <minutes>` pour en programmer une."
  },
  playlists: {
    created: "Playlist **{name}** cr\xE9\xE9e.",
    deleted: "Playlist **{name}** supprim\xE9e.",
    renamed: "Playlist **{old}** renomm\xE9e en **{new}**.",
    notFound: "Vous n'avez pas de playlist nomm\xE9e **{name}**.",
    exists: "Vous avez d\xE9j\xE0 une playlist nomm\xE9e **{name}**.",
    nameTooLong: "Les noms de playlist peuvent contenir au maximum 64 caract\xE8res.",
    addedTracks: "**{count}** morceaux ajout\xE9s \xE0 **{name}**.",
    addedCurrent: "**{title}** ajout\xE9 \xE0 **{name}**.",
    noCurrent: "Rien n'est en lecture \u2014 indiquez un nom ou une URL.",
    removedTrack: "**{title}** retir\xE9 de **{name}**.",
    listTitle: "Vos playlists",
    listEmpty: "Vous n'avez pas encore de playlist.",
    infoTitle: "Playlist : {name}",
    infoFooter: "{count} morceaux \u2022 {duration} \u2022 {visibility}",
    public: "Publique",
    private: "Priv\xE9e",
    loaded: "**{count}** morceaux charg\xE9s depuis **{name}**.",
    empty: "La playlist **{name}** est vide.",
    limitReached: "Les playlists peuvent contenir au maximum {limit} morceaux.",
    tooManyToAdd: "Cela d\xE9passerait la limite de {limit} morceaux de la playlist.",
    favorites: "Favoris",
    favoritesEmpty: "Vous n'avez pas encore de favoris.",
    favoritesAdded: "**{title}** ajout\xE9 \xE0 vos favoris.",
    favoritesRemoved: "**{title}** retir\xE9 de vos favoris.",
    favoritesLoaded: "**{count}** favoris charg\xE9s.",
    owner: "Propri\xE9taire",
    createdTitle: "Playlist cr\xE9\xE9e",
    deletedTitle: "Playlist supprim\xE9e",
    renamedTitle: "Playlist renomm\xE9e",
    addedTitle: "Piste ajout\xE9e",
    removedTrackTitle: "Piste retir\xE9e",
    visibilityTitle: "Visibilit\xE9 modifi\xE9e",
    loadedTitle: "Playlist charg\xE9e",
    savedQueueTitle: "File enregistr\xE9e",
    savedQueue: "File actuelle ({count} pistes) enregistr\xE9e dans la playlist **{name}**.",
    savedQueueUpdated: "Playlist **{name}** mise \xE0 jour avec la file actuelle ({count} pistes).",
    nothingToSave: "Rien ne joue \u2014 il n'y a pas de file \xE0 enregistrer."
  },
  filters: {
    applied: "Filtre **{name}** appliqu\xE9.",
    removed: "Filtre **{name}** retir\xE9.",
    reset: "Tous les filtres ont \xE9t\xE9 r\xE9initialis\xE9s.",
    listTitle: "Filtres actifs",
    listNone: "Aucun filtre actif.",
    invalidLevel: "Le niveau doit \xEAtre : low, medium, high ou insane.",
    invalidValue: "La valeur doit \xEAtre comprise entre {min} et {max}.",
    eqApplied: "\xC9galiseur personnalis\xE9 appliqu\xE9.",
    eqUsage: "Utilisation : `{prefix}eq <15 gains de -1 \xE0 1>` \u2014 ex. `{prefix}eq 0.3 0.3 0.2 0 -0.2 0 0 0 0 0 0 0 0 0 0`",
    appliedTitle: "Filtre appliqu\xE9",
    removedTitle: "Filtre retir\xE9",
    resetTitle: "Filtres r\xE9initialis\xE9s",
    resetAll: "R\xE9initialiser les filtres",
    openPanel: "Panneau des filtres",
    panelTitle: "Filtres audio",
    panelHint: "Choisissez un filtre pour l'activer ou le d\xE9sactiver \u2014 instantan\xE9.",
    pickPlaceholder: "Activer un filtre\u2026",
    stateOn: "OUI \u2014 s\xE9lectionner pour d\xE9sactiver",
    stateOff: "NON \u2014 s\xE9lectionner pour activer"
  },
  settings: {
    "247": "24/7 par d\xE9faut",
    title: "Param\xE8tres de {guild}",
    prefix: "Pr\xE9fixe",
    language: "Langue",
    djRoles: "R\xF4les DJ",
    botChannels: "Salons autoris\xE9s",
    defaultVolume: "Volume par d\xE9faut",
    autoplay: "Autoplay par d\xE9faut",
    idleTimeout: "D\xE9lai d'inactivit\xE9",
    allChannels: "Tous les salons",
    noTimeout: "D\xE9sactiv\xE9",
    prefixSet: "Pr\xE9fixe d\xE9fini sur `{prefix}`.",
    prefixInvalid: "Le pr\xE9fixe doit faire 1 \xE0 5 caract\xE8res et ne peut pas contenir d'espaces.",
    languageSet: "Langue d\xE9finie sur **{language}**.",
    languageInvalid: "Langues disponibles : {languages}.",
    djRoleAdded: "**{role}** est maintenant un r\xF4le DJ.",
    djRoleRemoved: "**{role}** n'est plus un r\xF4le DJ.",
    djRoleNotSet: "**{role}** n'est pas un r\xF4le DJ.",
    djRoleList: "R\xF4les DJ : {roles}",
    djRoleNone: "Aucun r\xF4le DJ n'est d\xE9fini.",
    botChannelAdded: "Les commandes musicales sont maintenant restreintes \xE0 **{channel}**.",
    botChannelRemoved: "**{channel}** a \xE9t\xE9 retir\xE9 des salons autoris\xE9s.",
    botChannelNotSet: "**{channel}** n'est pas dans les salons autoris\xE9s.",
    botChannelCleared: "Les commandes musicales sont maintenant autoris\xE9es dans tous les salons.",
    defaultVolumeSet: "Volume par d\xE9faut r\xE9gl\xE9 sur **{level}%**.",
    idleTimeoutSet: "D\xE9lai d'inactivit\xE9 r\xE9gl\xE9 sur **{minutes}** minutes.",
    idleTimeoutDisabled: "D\xE9lai d'inactivit\xE9 d\xE9sactiv\xE9 \u2014 je resterai jusqu'\xE0 l'arr\xEAt."
  },
  info: {
    helpTitle: "Slux \u2014 Aide",
    helpDescription: "Un bot musical riche en fonctionnalit\xE9s. Utilisez les commandes slash ou `{prefix}` comme pr\xE9fixe.",
    helpFields: {
      music: "Musique",
      playlists: "Playlists",
      filters: "Filtres",
      settings: "Param\xE8tres",
      info: "Infos"
    },
    helpFooter: "Voir toutes les commandes sur le tableau de bord",
    pingTitle: "Pong !",
    pingWebsocket: "Websocket",
    pingRoundtrip: "Aller-retour",
    pingLavalink: "Lavalink",
    statsTitle: "Slux \u2014 Statistiques",
    statsServers: "Serveurs",
    statsPlayers: "Lecteurs actifs",
    statsUsers: "Utilisateurs",
    statsUptime: "Uptime",
    statsMemory: "M\xE9moire",
    statsNode: "N\u0153ud Lavalink",
    statsNodePenalties: "P\xE9nalit\xE9s du n\u0153ud",
    inviteTitle: "Inviter Slux",
    inviteDescription: "Cliquez sur le bouton ci-dessous pour ajouter Slux \xE0 votre serveur.",
    aboutTitle: "\xC0 propos de Slux",
    aboutDescription: "Slux est un bot musical Discord gratuit et riche en fonctionnalit\xE9s avec Spotify, YouTube, SoundCloud, Deezer, Apple Music et plus \u2014 avec un tableau de bord web en temps r\xE9el.",
    aboutFooter: "Fait avec \u2665 \u2014 gratuit pour toujours, sans abonnement premium",
    helpPickCategory: "Choisissez une cat\xE9gorie\u2026",
    helpCategoryCount: "{count} commandes",
    helpAndMore: "+{count} autres",
    helpCommandsTitle: "Commandes",
    pingStatus: "\xC9tat de la connexion",
    inviteButton: "Inviter Slux",
    dashboardButton: "Ouvrir le tableau de bord",
    aboutSources: "Sources",
    aboutFeatures: "Points forts",
    nodesTitle: "N\u0153uds musicaux",
    nodesActive: "N\u0153ud actif : {name}",
    nodeConnected: "Connect\xE9",
    nodeConnecting: "Connexion\u2026",
    nodeDisconnecting: "D\xE9connexion\u2026",
    nodeDisconnected: "Hors ligne",
    nodePlayers: "Lecteurs",
    nodeCpu: "CPU",
    developerTitle: "Cr\xE9\xE9 par SHM",
    developerDescription: "Slux est con\xE7u, d\xE9velopp\xE9 et maintenu par **SHM**. Chaque fonctionnalit\xE9 \u2014 le moteur de lecture, les filtres, le tableau de bord et les paroles \u2014 est r\xE9alis\xE9e avec amour.",
    developerRole: "Cr\xE9ateur et d\xE9veloppeur",
    developerWorkTitle: "Le projet",
    developerWork: "Suivez **@Letzforge** sur YouTube pour des vid\xE9os de cr\xE9ation, des dev logs et des tutoriels sur des projets comme celui-ci.",
    developerFooter: "Cr\xE9\xE9 avec \u2764\uFE0F par SHM"
  },
  dashboard: {
    nav: {
      player: "Lecteur",
      settings: "Param\xE8tres",
      playlists: "Playlists",
      backToSite: "Retour au site",
      logout: "Se d\xE9connecter",
      dashboard: "Tableau de bord",
      commands: "Commandes",
      theme: "Th\xE8me"
    },
    landing: {
      badge: "Gratuit pour toujours \u2014 sans premium",
      title: "Une musique qui ne rate jamais un beat",
      subtitle: "Slux est un bot musical Discord riche en fonctionnalit\xE9s avec Spotify, YouTube, SoundCloud, Deezer et Apple Music \u2014 plus un tableau de bord en temps r\xE9el pour tout contr\xF4ler depuis votre navigateur.",
      addDiscord: "Ajouter \xE0 Discord",
      openDashboard: "Ouvrir le tableau de bord",
      featuresTitle: "Tout ce qu'il vous faut",
      featuresSubtitle: "Toutes les fonctionnalit\xE9s, gratuites pour tous. C'est la promesse Slux.",
      sourcesTitle: "Toutes vos sources",
      sourcesDescription: "Recherchez et lisez depuis Spotify, YouTube, SoundCloud, Deezer, Apple Music, Tidal et YouTube Music.",
      filtersTitle: "Filtres de studio",
      filtersDescription: "Bassboost, nightcore, vaporwave, 8D, karaok\xE9 et un \xE9galiseur 15 bandes complet.",
      playlistsTitle: "Playlists puissantes",
      playlistsDescription: "Sauvegardez vos morceaux favoris, importez des playlists et chargez-les en une commande.",
      lyricsTitle: "Paroles synchronis\xE9es",
      lyricsDescription: "Suivez les paroles sur Discord ou le tableau de bord, synchronis\xE9es au temps.",
      dashboardTitle: "Tableau de bord temps r\xE9el",
      dashboardDescription: "Contr\xF4lez la lecture, g\xE9rez la file d'attente et configurez le bot depuis votre navigateur.",
      autoplayTitle: "Autoplay et 24/7",
      autoplayDescription: "Slux continue la musique avec des titres similaires et peut rester en vocal toute la journ\xE9e.",
      i18nTitle: "Parle votre langue",
      i18nDescription: "Anglais, hindi, espagnol, fran\xE7ais, allemand et portugais inclus.",
      statsServers: "serveurs",
      statsPlayers: "lecteurs actifs",
      statsTracks: "morceaux jou\xE9s",
      ctaTitle: "Pr\xEAt \xE0 am\xE9liorer le son de votre serveur ?",
      ctaSubtitle: "Ajoutez Slux en moins d'une minute. Sans configuration, sans premium, sans limites."
    },
    commands: {
      title: "Commandes",
      subtitle: "Tout ce que Slux sait faire \u2014 en {count} commandes",
      search: "Rechercher des commandes...",
      noResults: "Aucune commande ne correspond \xE0 votre recherche.",
      usage: "Utilisation"
    },
    guilds: {
      title: "Vos serveurs",
      subtitle: "Choisissez un serveur \xE0 g\xE9rer",
      invite: "Inviter",
      manage: "G\xE9rer",
      empty: "Aucun serveur avec la permission G\xE9rer le serveur trouv\xE9."
    },
    settings: {
      title: "Param\xE8tres",
      general: "G\xE9n\xE9ral",
      playback: "Lecture",
      dj: "DJ",
      prefix: "Pr\xE9fixe de commandes",
      prefixDescription: "Pr\xE9fixe pour les commandes texte",
      language: "Langue",
      languageDescription: "Langue des r\xE9ponses du bot",
      defaultVolume: "Volume par d\xE9faut",
      defaultVolumeDescription: "Volume au d\xE9marrage du lecteur",
      autoplay: "Autoplay",
      autoplayDescription: "Continuer avec des titres similaires quand la file se termine",
      stay247: "Mode 24/7",
      stay247Description: "Rester dans le salon vocal quand seul ou inactif",
      idleTimeout: "D\xE9lai d'inactivit\xE9",
      idleTimeoutDescription: "Partir apr\xE8s ces minutes d'inactivit\xE9 (0 = jamais)",
      djRoles: "R\xF4les DJ",
      djRolesDescription: "R\xF4les pouvant utiliser les commandes DJ",
      botChannels: "Salons autoris\xE9s",
      botChannelsDescription: "Restreindre les commandes musicales \xE0 ces salons",
      allChannels: "Tous les salons autoris\xE9s",
      save: "Enregistrer",
      saved: "Param\xE8tres enregistr\xE9s",
      saveFailed: "\xC9chec de l'enregistrement des param\xE8tres",
      notAvailable: "Serveur indisponible \u2014 le bot y est-il ?"
    },
    player: {
      title: "Lecteur",
      notConnected: "Non connect\xE9",
      notConnectedDescription: "Slux n'est pas dans un salon vocal. Choisissez un salon pour commencer \xE0 \xE9couter.",
      join: "Rejoindre le salon",
      nowPlaying: "En cours de lecture",
      nothingPlaying: "Rien en lecture",
      queue: "File d'attente",
      queueEmpty: "La file est vide \u2014 cherchez quelque chose !",
      lyrics: "Paroles",
      noLyrics: "Aucune parole disponible pour ce morceau.",
      searchPlaceholder: "Rechercher ou coller un lien...",
      play: "Lire",
      pause: "Pause",
      resume: "Reprendre",
      previous: "Pr\xE9c\xE9dent",
      skip: "Passer",
      stop: "Arr\xEAter",
      shuffle: "M\xE9langer",
      loop: "Boucle",
      volume: "Volume",
      autoplay: "Autoplay",
      clear: "Vider la file",
      remove: "Retirer",
      moveTop: "D\xE9but de file",
      added: "Ajout\xE9 \xE0 la file",
      live: "EN DIRECT",
      lyricsSynced: "Synchronis\xE9es",
      lyricsPlain: "Brutes",
      autoScroll: "D\xE9filement auto",
      history: "Historique",
      historyEmpty: "L'historique est vide.",
      replay: "Rejouer",
      filtersTab: "Filtres",
      filtersNone: "Aucun filtre actif.",
      filtersReset: "R\xE9initialiser les filtres",
      seekHint: "Glisser pour naviguer",
      requestedBy: "Demand\xE9e par",
      playingIn: "Lecture dans",
      realtimeOff: "Temps r\xE9el d\xE9connect\xE9"
    },
    playlists: {
      title: "Vos playlists",
      subtitle: "Vos collections sauvegard\xE9es, disponibles sur tous les serveurs",
      create: "Nouvelle playlist",
      createTitle: "Cr\xE9er une playlist",
      namePlaceholder: "Nom de la playlist",
      descriptionPlaceholder: "Description (facultatif)",
      createCta: "Cr\xE9er",
      delete: "Supprimer la playlist",
      deleteConfirm: "Supprimer la playlist \xAB {name} \xBB ? Cette action est irr\xE9versible.",
      public: "Publique",
      private: "Priv\xE9e",
      tracks: "morceaux",
      empty: "Aucune playlist \u2014 cr\xE9ez la premi\xE8re !",
      loadToGuild: "Lire sur un serveur",
      removeTrack: "Retirer le morceau",
      created: "Playlist cr\xE9\xE9e",
      deleted: "Playlist supprim\xE9e",
      emptyPlaylist: "Cette playlist est vide."
    },
    auth: {
      login: "Se connecter avec Discord",
      loginRequired: "Connexion requise",
      loginRequiredDescription: "Vous devez vous connecter avec Discord pour acc\xE9der au tableau de bord."
    },
    user: {
      loggedInAs: "Connect\xE9 en tant que"
    }
  }
};

// src/i18n/locales/de.json
var de_default = {
  common: {
    error: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    noVoiceChannel: "Du musst zuerst einem Sprachkanal beitreten.",
    noPlayer: "Gerade l\xE4uft nichts.",
    notInSameVoice: "Du musst im selben Sprachkanal wie ich sein.",
    queueEmpty: "Die Warteschlange ist leer.",
    cancelled: "Abgebrochen.",
    timeUp: "Zeit abgelaufen.",
    djRequired: "F\xFCr diesen Befehl brauchst du eine DJ-Rolle oder die Berechtigung Kan\xE4le verwalten.",
    manageGuildRequired: "F\xFCr diesen Befehl brauchst du die Berechtigung Server verwalten.",
    blacklisted: "Du darfst diesen Bot nicht verwenden.",
    nothingFound: "F\xFCr diese Suche wurde nichts gefunden.",
    invalidNumber: "Bitte gib eine g\xFCltige Zahl an.",
    page: "Seite {current}/{total}",
    requestedBy: "Angefordert von {user}",
    unknownCommand: "Unbekannter Befehl. Versuche `{prefix}help`.",
    yes: "Ja",
    no: "Nein",
    enabled: "Aktiviert",
    disabled: "Deaktiviert",
    none: "Keine",
    minutes: "Minuten",
    tracks: "Titel",
    errorTitle: "Fehler",
    doneTitle: "Fertig",
    warnTitle: "Achtung",
    on: "AN",
    off: "AUS",
    commands: "Befehle",
    viewExpired: "Diese Ansicht ist abgelaufen \u2014 f\xFChre den Befehl erneut aus.",
    cooldown: "Du verwendest Befehle zu schnell \u2014 versuche es in wenigen Sekunden erneut.",
    channelNotAllowed: "Befehle sind in diesem Kanal nicht erlaubt.",
    mentionHelp: {
      title: "Hi, ich bin Slux!",
      description: "Der Musik-Bot deines Servers \u2014 Suche, Warteschlange, Songtexte, Filter und ein Live-Dashboard. So nutzt du mich:",
      prefixField: "Pr\xE4fix hier",
      prefixValue: "Nutze {prefix} vor Befehlen, z. B. {prefix}play",
      slashField: "Slash-Befehle",
      slashValue: "Tippe \xFCberall `/` und w\xE4hle einen Befehl.",
      popularField: "Beliebte Befehle",
      tipField: "Tipp",
      tipValue: "Erw\xE4hne mich jederzeit f\xFCr diese Nachricht, oder nutze {prefix}help f\xFCr die vollst\xE4ndige Liste.",
      commandsButton: "Alle Befehle",
      dashboardButton: "Dashboard",
      inviteButton: "Mich einladen"
    }
  },
  commands: {
    "247": {
      name: "247",
      description: "24/7 im Sprachkanal bleiben umschalten"
    },
    play: {
      name: "play",
      description: "Spiele einen Song, eine Playlist oder eine Suche",
      options: {
        query: "Songname, URL oder Playlist-Link"
      }
    },
    playnext: {
      name: "playnext",
      description: "F\xFCge einen Song hinzu, der direkt nach dem aktuellen gespielt wird",
      options: {
        query: "Songname oder URL"
      }
    },
    playtop: {
      name: "playtop",
      description: "F\xFCge einen Song am Anfang der Warteschlange hinzu",
      options: {
        query: "Songname oder URL"
      }
    },
    playskip: {
      name: "playskip",
      description: "F\xFCge einen Song oben hinzu und springe sofort zu ihm",
      options: {
        query: "Songname oder URL"
      }
    },
    pause: {
      name: "pause",
      description: "Pausiere den aktuellen Song"
    },
    resume: {
      name: "resume",
      description: "Setze den pausierten Song fort"
    },
    stop: {
      name: "stop",
      description: "Wiedergabe stoppen, Warteschlange leeren und verlassen"
    },
    skip: {
      name: "skip",
      description: "\xDCberspringe den aktuellen Song"
    },
    previous: {
      name: "previous",
      description: "Spiele den vorherigen Song aus dem Verlauf"
    },
    seek: {
      name: "seek",
      description: "Springe zu einer Position im aktuellen Song",
      options: {
        position: "Position wie 1:30, 90 oder 1m30s"
      }
    },
    forward: {
      name: "forward",
      description: "Um eine Anzahl Sekunden vorspulen",
      options: {
        seconds: "Sekunden zum Vorspulen"
      }
    },
    rewind: {
      name: "rewind",
      description: "Um eine Anzahl Sekunden zur\xFCckspulen",
      options: {
        seconds: "Sekunden zum Zur\xFCckspulen"
      }
    },
    queue: {
      name: "queue",
      description: "Zeige die aktuelle Warteschlange",
      options: {
        page: "Seitennummer"
      }
    },
    nowplaying: {
      name: "nowplaying",
      description: "Zeige den Song, der gerade l\xE4uft"
    },
    remove: {
      name: "remove",
      description: "Entferne einen Song aus der Warteschlange",
      options: {
        index: "Die zu entfernende Position"
      }
    },
    clear: {
      name: "clear",
      description: "Leere die gesamte Warteschlange"
    },
    move: {
      name: "move",
      description: "Verschiebe einen Song in der Warteschlange",
      options: {
        from: "Position von",
        to: "Position nach"
      }
    },
    shuffle: {
      name: "shuffle",
      description: "Warteschlange mischen"
    },
    loop: {
      name: "loop",
      description: "Wiederholungsmodus festlegen",
      options: {
        mode: "Modus: off, track oder queue"
      }
    },
    volume: {
      name: "volume",
      description: "Lautst\xE4rke festlegen oder anzeigen",
      options: {
        level: "Lautst\xE4rke von 0 bis 150"
      }
    },
    join: {
      name: "join",
      description: "Tritt deinem Sprachkanal bei"
    },
    replay: {
      name: "replay",
      description: "Aktuellen Song von vorne abspielen"
    },
    grab: {
      name: "grab",
      description: "Erhalte den aktuellen Song per DM"
    },
    search: {
      name: "search",
      description: "Suche Songs und w\xE4hle einen",
      options: {
        query: "Wonach gesucht werden soll"
      }
    },
    lyrics: {
      name: "lyrics",
      description: "Zeige den Songtext des aktuellen Songs"
    },
    autoplay: {
      name: "autoplay",
      description: "Autoplay \xE4hnlicher Songs umschalten"
    },
    djmode: {
      name: "djmode",
      description: "DJ-Modus: nur Sprachmitglieder k\xF6nnen den Bot steuern"
    },
    playlist: {
      name: "playlist",
      description: "Verwalte deine Playlists",
      subcommands: {
        create: {
          description: "Erstelle eine neue Playlist",
          options: {
            name: "Playlist-Name"
          }
        },
        delete: {
          description: "L\xF6sche eine deiner Playlists",
          options: {
            name: "Playlist-Name"
          }
        },
        rename: {
          description: "Benenne eine Playlist um",
          options: {
            old: "Aktueller Name",
            new: "Neuer Name"
          }
        },
        add: {
          description: "F\xFCge einer Playlist einen Song oder Link hinzu",
          options: {
            name: "Playlist-Name",
            query: "Song oder URL"
          }
        },
        remove: {
          description: "Entferne einen Titel nach Position",
          options: {
            name: "Playlist-Name",
            index: "Titelposition"
          }
        },
        list: {
          description: "Liste deine Playlists auf"
        },
        info: {
          description: "Zeige die Titel einer Playlist",
          options: {
            name: "Playlist-Name"
          }
        },
        load: {
          description: "Lade eine Playlist in die Warteschlange",
          options: {
            name: "Playlist-Name"
          }
        },
        public: {
          description: "Playlist zwischen \xF6ffentlich und privat umschalten",
          options: {
            name: "Playlist-Name"
          }
        },
        save: {
          description: "Die aktuelle Warteschlange als Playlist speichern",
          options: {
            name: "Name der Playlist"
          }
        }
      }
    },
    favorites: {
      name: "favorites",
      description: "Verwalte deine Lieblingssongs",
      subcommands: {
        add: {
          description: "F\xFCge den aktuellen Song oder eine Suche zu Favoriten hinzu",
          options: {
            query: "Songname oder URL (leer = aktueller Song)"
          }
        },
        remove: {
          description: "Entferne einen Favoriten nach Position",
          options: {
            index: "Favoritenposition"
          }
        },
        list: {
          description: "Liste deine Favoriten auf"
        },
        play: {
          description: "Spiele deine Favoriten"
        }
      }
    },
    bassboost: {
      name: "bassboost",
      description: "Bassboost-Filter umschalten",
      options: {
        level: "Stufe: low, medium, high oder insane"
      }
    },
    nightcore: {
      name: "nightcore",
      description: "Nightcore-Filter umschalten"
    },
    vaporwave: {
      name: "vaporwave",
      description: "Vaporwave-Filter umschalten"
    },
    soft: {
      name: "soft",
      description: "Soft-Filter umschalten"
    },
    "8d": {
      name: "8d",
      description: "8D-Audio-Filter umschalten"
    },
    karaoke: {
      name: "karaoke",
      description: "Karaoke-Filter umschalten"
    },
    tremolo: {
      name: "tremolo",
      description: "Tremolo-Filter umschalten"
    },
    vibrato: {
      name: "vibrato",
      description: "Vibrato-Filter umschalten"
    },
    distortion: {
      name: "distortion",
      description: "Distortion-Filter umschalten"
    },
    lowpass: {
      name: "lowpass",
      description: "Lowpass-Filter umschalten"
    },
    speed: {
      name: "speed",
      description: "Wiedergabegeschwindigkeit festlegen",
      options: {
        value: "Geschwindigkeit von 0.5 bis 5.0"
      }
    },
    pitch: {
      name: "pitch",
      description: "Tonh\xF6he festlegen",
      options: {
        value: "Tonh\xF6he von 0.5 bis 5.0"
      }
    },
    eq: {
      name: "eq",
      description: "Benutzerdefinierten Equalizer setzen wie 3 0 0 1 0 -1",
      options: {
        bands: "15 Verst\xE4rkungen von -1 bis 1"
      }
    },
    filters: {
      name: "filters",
      description: "Aktive Filter anzeigen"
    },
    filtersreset: {
      name: "reset",
      description: "Alle Filter zur\xFCcksetzen"
    },
    settings: {
      name: "settings",
      description: "Servereinstellungen anzeigen"
    },
    prefix: {
      name: "prefix",
      description: "Befehlspr\xE4fix f\xFCr diesen Server festlegen",
      options: {
        prefix: "Neuer Pr\xE4fix, bis zu 5 Zeichen"
      }
    },
    language: {
      name: "language",
      description: "Botsprache f\xFCr diesen Server festlegen",
      options: {
        language: "Zu verwendende Sprache"
      }
    },
    djrole: {
      name: "djrole",
      description: "DJ-Rollen verwalten",
      subcommands: {
        add: {
          description: "DJ-Rolle hinzuf\xFCgen",
          options: {
            role: "Die Rolle"
          }
        },
        remove: {
          description: "DJ-Rolle entfernen",
          options: {
            role: "Die Rolle"
          }
        },
        list: {
          description: "DJ-Rollen auflisten"
        }
      }
    },
    botchannel: {
      name: "botchannel",
      description: "Musikbefehle auf bestimmte Kan\xE4le beschr\xE4nken",
      subcommands: {
        add: {
          description: "Kanal erlauben",
          options: {
            channel: "Der Kanal"
          }
        },
        remove: {
          description: "Kanal verbieten",
          options: {
            channel: "Der Kanal"
          }
        },
        clear: {
          description: "Alle Kan\xE4le erlauben"
        }
      }
    },
    defaultvolume: {
      name: "defaultvolume",
      description: "Standardlautst\xE4rke f\xFCr diesen Server festlegen",
      options: {
        level: "Lautst\xE4rke von 0 bis 150"
      }
    },
    idletimeout: {
      name: "idletimeout",
      description: "Festlegen, wie lange bei Inaktivit\xE4t gewartet wird",
      options: {
        minutes: "Minuten, 0 zum Deaktivieren"
      }
    },
    help: {
      name: "help",
      description: "Hilfemen\xFC anzeigen"
    },
    ping: {
      name: "ping",
      description: "Bot-Latenz anzeigen"
    },
    stats: {
      name: "stats",
      description: "Bot-Statistiken anzeigen"
    },
    invite: {
      name: "invite",
      description: "Bot-Einladungslink abrufen"
    },
    about: {
      name: "about",
      description: "Infos \xFCber Slux anzeigen"
    },
    skipto: {
      description: "Zu einem bestimmten Titel in der Warteschlange springen",
      options: {
        index: "Warteschlangenposition, zu der gesprungen wird"
      }
    },
    removeduplicates: {
      description: "Duplizierte Titel aus der Warteschlange entfernen"
    },
    sleep: {
      description: "Wiedergabe nach einer Wartezeit pausieren (Sleep-Timer)",
      options: {
        minutes: "Minuten bis zur Pause (0 oder off zum Abbrechen)"
      }
    },
    nodes: {
      description: "Status der Musik-Knoten anzeigen"
    },
    developer: {
      description: "Lerne den Entwickler hinter Slux kennen"
    }
  },
  music: {
    nowPlaying: "Jetzt l\xE4uft",
    searching: "Suche...",
    added: "**{title}** zur Warteschlange hinzugef\xFCgt",
    addedAt: "**{title}** an Position #{position} der Warteschlange hinzugef\xFCgt",
    addedPlaylist: "**{count}** Titel von **{name}** zur Warteschlange hinzugef\xFCgt",
    selectPrompt: "W\xE4hle einen Titel \u2014 Ergebnisse f\xFCr `{query}`",
    selectButton: "W\xE4hlen",
    cancelButton: "Abbrechen",
    paused: "Player pausiert.",
    resumed: "Wiedergabe fortgesetzt.",
    alreadyPaused: "Der Player ist bereits pausiert.",
    notPaused: "Der Player ist nicht pausiert.",
    stopped: "Player gestoppt und Kanal verlassen.",
    skipped: "**{title}** \xFCbersprungen.",
    noPrevious: "Es gibt keinen vorherigen Song.",
    previousNow: "Vorheriger Song l\xE4uft jetzt.",
    queueTitle: "Warteschlange von {guild}",
    queueNowPlaying: "**L\xE4uft gerade** \u2014 [{title}]({uri}) `{duration}`",
    queueUpNext: "Als N\xE4chstes",
    queueFooter: "{count} Titel \u2022 {duration} insgesamt",
    npLength: "L\xE4nge",
    npPosition: "Position",
    npVolume: "Lautst\xE4rke",
    npLoop: "Wiederholung",
    npFilters: "Filter",
    live: "LIVE",
    stream: "Live-Stream",
    removed: "**{title}** aus der Warteschlange entfernt.",
    invalidIndex: "An Position #{index} gibt es keinen Titel.",
    cleared: "Warteschlange geleert ({count} Titel).",
    moved: "**{title}** von #{from} nach #{to} verschoben.",
    shuffled: "Warteschlange gemischt ({count} Titel).",
    loopOff: "Wiederholung ist jetzt **aus**.",
    loopTrack: "Der **aktuelle Titel** wird wiederholt.",
    loopQueue: "Die **Warteschlange** wird wiederholt.",
    volumeSet: "Lautst\xE4rke auf **{level}%** gesetzt.",
    volumeCurrent: "Die Lautst\xE4rke betr\xE4gt derzeit **{level}%**.",
    seeked: "Zu **{position}** gesprungen.",
    seekInvalid: "Ung\xFCltige Position \u2014 der Song ist nur {length} lang.",
    forwarded: "Vorgespult zu **{position}**.",
    rewound: "Zur\xFCckgespult zu **{position}**.",
    joined: "**{channel}** beigetreten.",
    joinFailed: "Ich konnte diesem Sprachkanal nicht beitreten.",
    replaying: "Aktueller Song wird erneut abgespielt.",
    grabTitle: "Song gespeichert",
    grabDmed: "Ich habe dir den aktuellen Song per DM geschickt.",
    grabDmFailed: "Ich konnte dir keine DM senden \u2014 bitte aktiviere DMs von Servermitgliedern.",
    lyricsTitle: "Songtext von {title}",
    lyricsNone: "F\xFCr den aktuellen Song wurde kein Songtext gefunden.",
    autoplayOn: "Autoplay ist jetzt **aktiviert** \u2014 ich spiele weiter \xE4hnliche Songs.",
    autoplayOff: "Autoplay ist jetzt **deaktiviert**.",
    stayOn: "24/7-Modus ist jetzt **aktiviert** \u2014 ich bleibe im Kanal.",
    stayOff: "24/7-Modus ist jetzt **deaktiviert**.",
    djmodeOn: "DJ-Modus ist jetzt **aktiviert** \u2014 nur Zuh\xF6rer im Sprachkanal k\xF6nnen mich steuern.",
    djmodeOff: "DJ-Modus ist jetzt **deaktiviert**.",
    djmodeActive: "DJ-Modus ist aktiv \u2014 nur Zuh\xF6rer im Sprachkanal k\xF6nnen mich steuern.",
    leftIdle: "Kanal wegen Inaktivit\xE4t verlassen.",
    leftAlone: "Kanal verlassen, weil alle gegangen sind.",
    notSeekable: "In diesem Titel kann nicht gesprungen werden.",
    queueEnded: "Die Warteschlange ist zu Ende.",
    pausedLabel: "Pausiert",
    addedTitle: "Zur Warteschlange hinzugef\xFCgt",
    addedTopTitle: "Oben hinzugef\xFCgt",
    skipPlayTitle: "\xDCberspringe zu",
    playlistAddedTitle: "Playlist hinzugef\xFCgt",
    queuePosition: "Position",
    queueTotal: "Warteschlange",
    totalDuration: "Gesamtdauer",
    searchResultsTitle: "Suchergebnisse",
    selectFooter: "W\xE4hle unten einen Titel",
    selectPlaceholder: "Titel ausw\xE4hlen\u2026",
    stoppedTitle: "Gestoppt",
    skippedTitle: "\xDCbersprungen",
    previousTitle: "Vorheriger Titel",
    queueJumpTo: "Zur Seite springen\u2026",
    queuePageOption: "Seite {page}",
    npProgress: "Fortschritt",
    removedTitle: "Entfernt",
    clearedTitle: "Warteschlange geleert",
    movedTitle: "Titel verschoben",
    shuffledTitle: "Gemischt",
    loopTitle: "Wiederholungsmodus",
    loopCurrent: "Wiederholungsmodus: {mode}",
    loopModeOff: "Aus",
    loopModeTrack: "Titel",
    loopModeQueue: "Warteschlange",
    volumeTitle: "Lautst\xE4rke",
    volDown: "Lautst\xE4rke \u221210",
    volUp: "Lautst\xE4rke +10",
    volMute: "Stumm",
    pausedTitle: "Pausiert",
    resumedTitle: "Fortgesetzt",
    seekedTitle: "Position ge\xE4ndert",
    forwardedTitle: "Vorgespult",
    rewoundTitle: "Zur\xFCckgespult",
    replayingTitle: "Wird erneut abgespielt",
    joinedTitle: "Beigetreten",
    grabSource: "Quelle",
    lyricsSynced: "Synchronisiert",
    lyricsPlain: "Einfach",
    autoplayLabel: "Autoplay",
    djmodeLabel: "DJ-Modus",
    ctrlPrevious: "Zur\xFCck",
    ctrlPause: "Pause",
    ctrlResume: "Weiter",
    ctrlSkip: "\xDCberspringen",
    ctrlLoop: "Schleife",
    ctrlStop: "Stoppen",
    ctrlShuffle: "Mischen",
    ctrlQueue: "Warteschlange",
    ctrlLyrics: "Songtext",
    ctrlVolDown: "Vol \u221210",
    ctrlVolUp: "Vol +10",
    engineNotReady: "Die Musik-Engine ist noch nicht verbunden \u2014 Lavalink startet noch oder ist nicht erreichbar. Versuche es in einer Minute erneut (siehe Bot-Konsole).",
    skiptoTitle: "Zum Titel gesprungen",
    skiptoDone: "Direkt zu Position {index} gesprungen \u2014 alles davor wurde verworfen.",
    removedDuplicatesTitle: "Duplikate entfernt",
    removedDuplicates: "**{count}** duplizierte(r) Titel aus der Warteschlange entfernt.",
    noDuplicates: "Keine Duplikate gefunden \u2014 deine Warteschlange ist sauber!",
    sleepTitle: "Sleep-Timer",
    sleepSet: "Ich pausiere die Wiedergabe in {minutes} Minute(n).",
    sleepCancelled: "Sleep-Timer abgebrochen.",
    sleepStatus: "Die Wiedergabe pausiert in {minutes} Minute(n).",
    sleepNone: "Kein Sleep-Timer gesetzt. Nutze `sleep <Minuten>`, um einen festzulegen."
  },
  playlists: {
    created: "Playlist **{name}** erstellt.",
    deleted: "Playlist **{name}** gel\xF6scht.",
    renamed: "Playlist **{old}** in **{new}** umbenannt.",
    notFound: "Du hast keine Playlist namens **{name}**.",
    exists: "Du hast bereits eine Playlist namens **{name}**.",
    nameTooLong: "Playlist-Namen d\xFCrfen h\xF6chstens 64 Zeichen lang sein.",
    addedTracks: "**{count}** Titel zu **{name}** hinzugef\xFCgt.",
    addedCurrent: "**{title}** zu **{name}** hinzugef\xFCgt.",
    noCurrent: "Es l\xE4uft nichts \u2014 gib einen Songnamen oder eine URL an.",
    removedTrack: "**{title}** aus **{name}** entfernt.",
    listTitle: "Deine Playlists",
    listEmpty: "Du hast noch keine Playlists.",
    infoTitle: "Playlist: {name}",
    infoFooter: "{count} Titel \u2022 {duration} \u2022 {visibility}",
    public: "\xD6ffentlich",
    private: "Privat",
    loaded: "**{count}** Titel aus **{name}** geladen.",
    empty: "Die Playlist **{name}** ist leer.",
    limitReached: "Playlists k\xF6nnen h\xF6chstens {limit} Titel enthalten.",
    tooManyToAdd: "Damit w\xFCrde das Limit von {limit} Titeln \xFCberschritten.",
    favorites: "Favoriten",
    favoritesEmpty: "Du hast noch keine Favoriten.",
    favoritesAdded: "**{title}** zu deinen Favoriten hinzugef\xFCgt.",
    favoritesRemoved: "**{title}** aus deinen Favoriten entfernt.",
    favoritesLoaded: "**{count}** Favoriten geladen.",
    owner: "Besitzer",
    createdTitle: "Playlist erstellt",
    deletedTitle: "Playlist gel\xF6scht",
    renamedTitle: "Playlist umbenannt",
    addedTitle: "Titel hinzugef\xFCgt",
    removedTrackTitle: "Titel entfernt",
    visibilityTitle: "Sichtbarkeit ge\xE4ndert",
    loadedTitle: "Playlist geladen",
    savedQueueTitle: "Warteschlange gespeichert",
    savedQueue: "Aktuelle Warteschlange ({count} Titel) in Playlist **{name}** gespeichert.",
    savedQueueUpdated: "Playlist **{name}** mit der aktuellen Warteschlange ({count} Titel) aktualisiert.",
    nothingToSave: "Es spielt nichts \u2014 es gibt keine Warteschlange zu speichern."
  },
  filters: {
    applied: "Filter **{name}** angewendet.",
    removed: "Filter **{name}** entfernt.",
    reset: "Alle Filter wurden zur\xFCckgesetzt.",
    listTitle: "Aktive Filter",
    listNone: "Es sind keine Filter aktiv.",
    invalidLevel: "Die Stufe muss sein: low, medium, high oder insane.",
    invalidValue: "Der Wert muss zwischen {min} und {max} liegen.",
    eqApplied: "Benutzerdefinierter Equalizer angewendet.",
    eqUsage: "Verwendung: `{prefix}eq <15 Verst\xE4rkungen von -1 bis 1>` \u2014 z. B. `{prefix}eq 0.3 0.3 0.2 0 -0.2 0 0 0 0 0 0 0 0 0 0`",
    appliedTitle: "Filter angewendet",
    removedTitle: "Filter entfernt",
    resetTitle: "Filter zur\xFCckgesetzt",
    resetAll: "Filter zur\xFCcksetzen",
    openPanel: "Filterpanel",
    panelTitle: "Audiofilter",
    panelHint: "W\xE4hle einen Filter zum Ein- oder Ausschalten \u2014 sofort wirksam.",
    pickPlaceholder: "Filter umschalten\u2026",
    stateOn: "AN \u2014 zum Ausschalten w\xE4hlen",
    stateOff: "AUS \u2014 zum Einschalten w\xE4hlen"
  },
  settings: {
    "247": "Standard 24/7",
    title: "Einstellungen von {guild}",
    prefix: "Pr\xE4fix",
    language: "Sprache",
    djRoles: "DJ-Rollen",
    botChannels: "Erlaubte Kan\xE4le",
    defaultVolume: "Standardlautst\xE4rke",
    autoplay: "Standard-Autoplay",
    idleTimeout: "Inaktivit\xE4tszeit",
    allChannels: "Alle Kan\xE4le",
    noTimeout: "Deaktiviert",
    prefixSet: "Pr\xE4fix auf `{prefix}` gesetzt.",
    prefixInvalid: "Der Pr\xE4fix muss 1-5 Zeichen lang sein und darf keine Leerzeichen enthalten.",
    languageSet: "Sprache auf **{language}** gesetzt.",
    languageInvalid: "Verf\xFCgbare Sprachen: {languages}.",
    djRoleAdded: "**{role}** ist jetzt eine DJ-Rolle.",
    djRoleRemoved: "**{role}** ist keine DJ-Rolle mehr.",
    djRoleNotSet: "**{role}** ist keine DJ-Rolle.",
    djRoleList: "DJ-Rollen: {roles}",
    djRoleNone: "Es sind keine DJ-Rollen festgelegt.",
    botChannelAdded: "Musikbefehle sind jetzt auf **{channel}** beschr\xE4nkt.",
    botChannelRemoved: "**{channel}** wurde aus den erlaubten Kan\xE4len entfernt.",
    botChannelNotSet: "**{channel}** ist nicht in den erlaubten Kan\xE4len.",
    botChannelCleared: "Musikbefehle sind jetzt in allen Kan\xE4len erlaubt.",
    defaultVolumeSet: "Standardlautst\xE4rke auf **{level}%** gesetzt.",
    idleTimeoutSet: "Inaktivit\xE4tszeit auf **{minutes}** Minuten gesetzt.",
    idleTimeoutDisabled: "Inaktivit\xE4tszeit deaktiviert \u2014 ich bleibe bis zum Stopp."
  },
  info: {
    helpTitle: "Slux \u2014 Hilfe",
    helpDescription: "Ein funktionsreicher Musikbot. Nutze Slash-Befehle oder `{prefix}` als Pr\xE4fix.",
    helpFields: {
      music: "Musik",
      playlists: "Playlists",
      filters: "Filter",
      settings: "Einstellungen",
      info: "Infos"
    },
    helpFooter: "Alle Befehle im Dashboard ansehen",
    pingTitle: "Pong!",
    pingWebsocket: "Websocket",
    pingRoundtrip: "Roundtrip",
    pingLavalink: "Lavalink",
    statsTitle: "Slux \u2014 Statistiken",
    statsServers: "Server",
    statsPlayers: "Aktive Player",
    statsUsers: "Nutzer",
    statsUptime: "Uptime",
    statsMemory: "Speicher",
    statsNode: "Lavalink-Knoten",
    statsNodePenalties: "Knoten-Strafen",
    inviteTitle: "Slux einladen",
    inviteDescription: "Klicke auf die Schaltfl\xE4che unten, um Slux zu deinem Server hinzuzuf\xFCgen.",
    aboutTitle: "\xDCber Slux",
    aboutDescription: "Slux ist ein kostenloser, funktionsreicher Discord-Musikbot mit Spotify, YouTube, SoundCloud, Deezer, Apple Music und mehr \u2014 mit einem Echtzeit-Web-Dashboard.",
    aboutFooter: "Mit \u2665 gemacht \u2014 f\xFCr immer kostenlos, keine Premium-Stufen",
    helpPickCategory: "Befehlskategorie w\xE4hlen\u2026",
    helpCategoryCount: "{count} Befehle",
    helpAndMore: "+{count} weitere",
    helpCommandsTitle: "Befehle",
    pingStatus: "Verbindungsstatus",
    inviteButton: "Slux einladen",
    dashboardButton: "Dashboard \xF6ffnen",
    aboutSources: "Quellen",
    aboutFeatures: "Highlights",
    nodesTitle: "Musik-Knoten",
    nodesActive: "Aktiver Knoten: {name}",
    nodeConnected: "Verbunden",
    nodeConnecting: "Verbinde\u2026",
    nodeDisconnecting: "Trenne\u2026",
    nodeDisconnected: "Offline",
    nodePlayers: "Player",
    nodeCpu: "CPU",
    developerTitle: "Von SHM entwickelt",
    developerDescription: "Slux wird von **SHM** gestaltet, entwickelt und gepflegt. Jede Funktion \u2014 Player-Engine, Filter, Dashboard und Songtexte \u2014 ist mit Liebe gebaut.",
    developerRole: "Sch\xF6pfer & Entwickler",
    developerWorkTitle: "Das Projekt",
    developerWork: "Folge **@Letzforge** auf YouTube f\xFCr Build-Videos, Dev-Logs und Tutorials zu Projekten wie diesem.",
    developerFooter: "Mit \u2764\uFE0F von SHM gemacht"
  },
  dashboard: {
    nav: {
      player: "Player",
      settings: "Einstellungen",
      playlists: "Playlists",
      backToSite: "Zur\xFCck zur Seite",
      logout: "Abmelden",
      dashboard: "Dashboard",
      commands: "Befehle",
      theme: "Design"
    },
    landing: {
      badge: "F\xFCr immer kostenlos \u2014 kein Premium",
      title: "Musik, die nie einen Beat verpasst",
      subtitle: "Slux ist ein funktionsreicher Discord-Musikbot mit Spotify-, YouTube-, SoundCloud-, Deezer- und Apple-Music-Unterst\xFCtzung \u2014 plus Echtzeit-Dashboard, um alles vom Browser aus zu steuern.",
      addDiscord: "Zu Discord hinzuf\xFCgen",
      openDashboard: "Dashboard \xF6ffnen",
      featuresTitle: "Alles, was du brauchst",
      featuresSubtitle: "Alle Funktionen, f\xFCr alle kostenlos. Das ist das Slux-Versprechen.",
      sourcesTitle: "Alle deine Quellen",
      sourcesDescription: "Suche und spiele von Spotify, YouTube, SoundCloud, Deezer, Apple Music, Tidal und YouTube Music.",
      filtersTitle: "Studio-Filter",
      filtersDescription: "Bassboost, Nightcore, Vaporwave, 8D, Karaoke und ein voller 15-Band-Equalizer.",
      playlistsTitle: "Starke Playlists",
      playlistsDescription: "Speichere deine Lieblingstitel, importiere Playlists und lade sie mit einem Befehl.",
      lyricsTitle: "Synchronisierte Songtexte",
      lyricsDescription: "Folge dem Text in Discord oder im Dashboard mit zeitsynchronisierten Lyrics.",
      dashboardTitle: "Echtzeit-Dashboard",
      dashboardDescription: "Steuere die Wiedergabe, verwalte die Warteschlange und konfiguriere den Bot im Browser.",
      autoplayTitle: "Autoplay & 24/7",
      autoplayDescription: "Slux spielt mit \xE4hnlichen Titeln weiter und kann den ganzen Tag im Sprachkanal bleiben.",
      i18nTitle: "Spricht deine Sprache",
      i18nDescription: "Englisch, Hindi, Spanisch, Franz\xF6sisch, Deutsch und Portugiesisch inklusive.",
      statsServers: "Server",
      statsPlayers: "aktive Player",
      statsTracks: "gespielte Titel",
      ctaTitle: "Bereit, den Sound deines Servers zu verbessern?",
      ctaSubtitle: "F\xFCge Slux in unter einer Minute hinzu. Kein Setup, kein Premium, keine Limits."
    },
    commands: {
      title: "Befehle",
      subtitle: "Alles, was Slux kann \u2014 in {count} Befehlen",
      search: "Befehle suchen...",
      noResults: "Keine Befehle entsprechen deiner Suche.",
      usage: "Verwendung"
    },
    guilds: {
      title: "Deine Server",
      subtitle: "W\xE4hle einen Server zum Verwalten",
      invite: "Einladen",
      manage: "Verwalten",
      empty: "Keine Server mit der Berechtigung Server verwalten gefunden."
    },
    settings: {
      title: "Einstellungen",
      general: "Allgemein",
      playback: "Wiedergabe",
      dj: "DJ",
      prefix: "Befehlspr\xE4fix",
      prefixDescription: "Pr\xE4fix f\xFCr Textbefehle",
      language: "Sprache",
      languageDescription: "Sprache der Bot-Antworten",
      defaultVolume: "Standardlautst\xE4rke",
      defaultVolumeDescription: "Lautst\xE4rke beim Start des Players",
      autoplay: "Autoplay",
      autoplayDescription: "\xC4hnliche Titel weiterspielen, wenn die Warteschlange endet",
      stay247: "24/7-Modus",
      stay247Description: "Im Sprachkanal bleiben, wenn allein oder inaktiv",
      idleTimeout: "Inaktivit\xE4tszeit",
      idleTimeoutDescription: "Nach so vielen Minuten Inaktivit\xE4t verlassen (0 = nie)",
      djRoles: "DJ-Rollen",
      djRolesDescription: "Rollen, die DJ-Befehle nutzen k\xF6nnen",
      botChannels: "Erlaubte Kan\xE4le",
      botChannelsDescription: "Musikbefehle auf diese Kan\xE4le beschr\xE4nken",
      allChannels: "Alle Kan\xE4le erlaubt",
      save: "\xC4nderungen speichern",
      saved: "Einstellungen gespeichert",
      saveFailed: "Speichern der Einstellungen fehlgeschlagen",
      notAvailable: "Server nicht verf\xFCgbar \u2014 ist der Bot dort?"
    },
    player: {
      title: "Player",
      notConnected: "Nicht verbunden",
      notConnectedDescription: "Slux ist in keinem Sprachkanal. W\xE4hle einen Kanal, um zuzuh\xF6ren.",
      join: "Kanal beitreten",
      nowPlaying: "Jetzt l\xE4uft",
      nothingPlaying: "Nichts l\xE4uft",
      queue: "Warteschlange",
      queueEmpty: "Die Warteschlange ist leer \u2014 such etwas!",
      lyrics: "Songtext",
      noLyrics: "F\xFCr diesen Titel sind keine Lyrics verf\xFCgbar.",
      searchPlaceholder: "Suchen oder Link einf\xFCgen...",
      play: "Wiedergabe",
      pause: "Pause",
      resume: "Fortsetzen",
      previous: "Zur\xFCck",
      skip: "\xDCberspringen",
      stop: "Stopp",
      shuffle: "Mischen",
      loop: "Wiederholung",
      volume: "Lautst\xE4rke",
      autoplay: "Autoplay",
      clear: "Warteschlange leeren",
      remove: "Entfernen",
      moveTop: "Nach oben",
      added: "Zur Warteschlange hinzugef\xFCgt",
      live: "LIVE",
      lyricsSynced: "Synchronisiert",
      lyricsPlain: "Einfach",
      autoScroll: "Auto-Scroll",
      history: "Verlauf",
      historyEmpty: "Der Verlauf ist noch leer.",
      replay: "Erneut abspielen",
      filtersTab: "Filter",
      filtersNone: "Keine Filter aktiv.",
      filtersReset: "Filter zur\xFCcksetzen",
      seekHint: "Ziehen zum Spulen",
      requestedBy: "Angefragt von",
      playingIn: "Spielt in",
      realtimeOff: "Echtzeit getrennt"
    },
    playlists: {
      title: "Deine Playlists",
      subtitle: "Deine gespeicherten Sammlungen, auf jedem Server verf\xFCgbar",
      create: "Neue Playlist",
      createTitle: "Playlist erstellen",
      namePlaceholder: "Playlist-Name",
      descriptionPlaceholder: "Beschreibung (optional)",
      createCta: "Erstellen",
      delete: "Playlist l\xF6schen",
      deleteConfirm: "Playlist \u201E{name}\u201C l\xF6schen? Dies kann nicht r\xFCckg\xE4ngig gemacht werden.",
      public: "\xD6ffentlich",
      private: "Privat",
      tracks: "Titel",
      empty: "Noch keine Playlists \u2014 erstelle deine erste!",
      loadToGuild: "Auf einem Server spielen",
      removeTrack: "Titel entfernen",
      created: "Playlist erstellt",
      deleted: "Playlist gel\xF6scht",
      emptyPlaylist: "Diese Playlist ist leer."
    },
    auth: {
      login: "Mit Discord anmelden",
      loginRequired: "Anmeldung erforderlich",
      loginRequiredDescription: "Du musst dich mit Discord anmelden, um auf das Dashboard zuzugreifen."
    },
    user: {
      loggedInAs: "Angemeldet als"
    }
  }
};

// src/i18n/locales/pt.json
var pt_default = {
  common: {
    error: "Algo deu errado. Por favor, tente novamente.",
    noVoiceChannel: "Voc\xEA precisa entrar em um canal de voz primeiro.",
    noPlayer: "Nada est\xE1 tocando agora.",
    notInSameVoice: "Voc\xEA precisa estar no mesmo canal de voz que eu.",
    queueEmpty: "A fila est\xE1 vazia.",
    cancelled: "Cancelado.",
    timeUp: "Tempo esgotado.",
    djRequired: "Voc\xEA precisa de um cargo de DJ ou da permiss\xE3o Gerenciar Canais para usar este comando.",
    manageGuildRequired: "Voc\xEA precisa da permiss\xE3o Gerenciar Servidor para usar este comando.",
    blacklisted: "Voc\xEA n\xE3o tem permiss\xE3o para usar este bot.",
    nothingFound: "Nada encontrado para essa pesquisa.",
    invalidNumber: "Por favor, forne\xE7a um n\xFAmero v\xE1lido.",
    page: "P\xE1gina {current}/{total}",
    requestedBy: "Solicitado por {user}",
    unknownCommand: "Comando desconhecido. Tente `{prefix}help`.",
    yes: "Sim",
    no: "N\xE3o",
    enabled: "Ativado",
    disabled: "Desativado",
    none: "Nenhum",
    minutes: "minutos",
    tracks: "faixas",
    errorTitle: "Erro",
    doneTitle: "Conclu\xEDdo",
    warnTitle: "Aten\xE7\xE3o",
    on: "SIM",
    off: "N\xC3O",
    commands: "comandos",
    viewExpired: "Esta visualiza\xE7\xE3o expirou \u2014 execute o comando novamente.",
    cooldown: "Voc\xEA est\xE1 usando comandos r\xE1pido demais \u2014 tente novamente em alguns segundos.",
    channelNotAllowed: "Comandos n\xE3o s\xE3o permitidos neste canal.",
    mentionHelp: {
      title: "Oi, eu sou o Slux!",
      description: "O bot de m\xFAsica do seu servidor \u2014 busca, fila, letras, filtros e um painel web ao vivo. Veja como me usar:",
      prefixField: "Prefixo aqui",
      prefixValue: "Use {prefix} antes dos comandos, ex.: {prefix}play",
      slashField: "Comandos slash",
      slashValue: "Digite `/` em qualquer lugar e escolha um comando.",
      popularField: "Comandos populares",
      tipField: "Dica",
      tipValue: "Mencione-me a qualquer momento para ver esta mensagem, ou use {prefix}help para a lista completa.",
      commandsButton: "Todos os comandos",
      dashboardButton: "Painel",
      inviteButton: "Me convide"
    }
  },
  commands: {
    "247": {
      name: "247",
      description: "Ative/desative ficar no canal de voz 24/7"
    },
    play: {
      name: "play",
      description: "Toque uma m\xFAsica, playlist ou pesquisa",
      options: {
        query: "Nome da m\xFAsica, URL ou link de playlist"
      }
    },
    playnext: {
      name: "playnext",
      description: "Adicione uma m\xFAsica para tocar logo ap\xF3s a atual",
      options: {
        query: "Nome da m\xFAsica ou URL"
      }
    },
    playtop: {
      name: "playtop",
      description: "Adicione uma m\xFAsica ao topo da fila",
      options: {
        query: "Nome da m\xFAsica ou URL"
      }
    },
    playskip: {
      name: "playskip",
      description: "Adicione uma m\xFAsica ao topo e pule para ela imediatamente",
      options: {
        query: "Nome da m\xFAsica ou URL"
      }
    },
    pause: {
      name: "pause",
      description: "Pause a m\xFAsica atual"
    },
    resume: {
      name: "resume",
      description: "Retome a m\xFAsica pausada"
    },
    stop: {
      name: "stop",
      description: "Pare de tocar, limpe a fila e saia"
    },
    skip: {
      name: "skip",
      description: "Pule a m\xFAsica atual"
    },
    previous: {
      name: "previous",
      description: "Toque a m\xFAsica anterior do hist\xF3rico"
    },
    seek: {
      name: "seek",
      description: "V\xE1 para uma posi\xE7\xE3o na m\xFAsica atual",
      options: {
        position: "Posi\xE7\xE3o como 1:30, 90 ou 1m30s"
      }
    },
    forward: {
      name: "forward",
      description: "Avance alguns segundos",
      options: {
        seconds: "Segundos a avan\xE7ar"
      }
    },
    rewind: {
      name: "rewind",
      description: "Retroceda alguns segundos",
      options: {
        seconds: "Segundos a retroceder"
      }
    },
    queue: {
      name: "queue",
      description: "Mostre a fila atual",
      options: {
        page: "N\xFAmero da p\xE1gina"
      }
    },
    nowplaying: {
      name: "nowplaying",
      description: "Mostre a m\xFAsica que est\xE1 tocando"
    },
    remove: {
      name: "remove",
      description: "Remova uma m\xFAsica da fila",
      options: {
        index: "A posi\xE7\xE3o da fila a remover"
      }
    },
    clear: {
      name: "clear",
      description: "Limpe toda a fila"
    },
    move: {
      name: "move",
      description: "Mova uma m\xFAsica dentro da fila",
      options: {
        from: "Posi\xE7\xE3o de origem",
        to: "Posi\xE7\xE3o de destino"
      }
    },
    shuffle: {
      name: "shuffle",
      description: "Embaralhe a fila"
    },
    loop: {
      name: "loop",
      description: "Defina o modo de repeti\xE7\xE3o",
      options: {
        mode: "Modo: off, track ou queue"
      }
    },
    volume: {
      name: "volume",
      description: "Defina ou veja o volume",
      options: {
        level: "Volume de 0 a 150"
      }
    },
    join: {
      name: "join",
      description: "Entre no seu canal de voz"
    },
    replay: {
      name: "replay",
      description: "Re toque a m\xFAsica atual do in\xEDcio"
    },
    grab: {
      name: "grab",
      description: "Receba a m\xFAsica atual na sua DM"
    },
    search: {
      name: "search",
      description: "Pesquise m\xFAsicas e escolha uma",
      options: {
        query: "O que pesquisar"
      }
    },
    lyrics: {
      name: "lyrics",
      description: "Mostre a letra da m\xFAsica atual"
    },
    autoplay: {
      name: "autoplay",
      description: "Ative/desative a reprodu\xE7\xE3o autom\xE1tica"
    },
    djmode: {
      name: "djmode",
      description: "Modo DJ: apenas membros do canal controlam o bot"
    },
    playlist: {
      name: "playlist",
      description: "Gerencie suas playlists",
      subcommands: {
        create: {
          description: "Crie uma nova playlist",
          options: {
            name: "Nome da playlist"
          }
        },
        delete: {
          description: "Exclua uma das suas playlists",
          options: {
            name: "Nome da playlist"
          }
        },
        rename: {
          description: "Renomeie uma playlist",
          options: {
            old: "Nome atual",
            new: "Novo nome"
          }
        },
        add: {
          description: "Adicione uma m\xFAsica ou link a uma playlist",
          options: {
            name: "Nome da playlist",
            query: "M\xFAsica ou URL"
          }
        },
        remove: {
          description: "Remova uma faixa por posi\xE7\xE3o",
          options: {
            name: "Nome da playlist",
            index: "Posi\xE7\xE3o da faixa"
          }
        },
        list: {
          description: "Liste suas playlists"
        },
        info: {
          description: "Mostre as faixas de uma playlist",
          options: {
            name: "Nome da playlist"
          }
        },
        load: {
          description: "Carregue uma playlist na fila",
          options: {
            name: "Nome da playlist"
          }
        },
        public: {
          description: "Alterne uma playlist entre p\xFAblica e privada",
          options: {
            name: "Nome da playlist"
          }
        },
        save: {
          description: "Salva a fila atual como playlist",
          options: {
            name: "Nome da playlist"
          }
        }
      }
    },
    favorites: {
      name: "favorites",
      description: "Gerencie suas m\xFAsicas favoritas",
      subcommands: {
        add: {
          description: "Adicione a m\xFAsica atual ou uma pesquisa aos favoritos",
          options: {
            query: "Nome ou URL (vazio = m\xFAsica atual)"
          }
        },
        remove: {
          description: "Remova um favorito por posi\xE7\xE3o",
          options: {
            index: "Posi\xE7\xE3o do favorito"
          }
        },
        list: {
          description: "Liste seus favoritos"
        },
        play: {
          description: "Toque seus favoritos"
        }
      }
    },
    bassboost: {
      name: "bassboost",
      description: "Ative/desative o filtro bassboost",
      options: {
        level: "N\xEDvel: low, medium, high ou insane"
      }
    },
    nightcore: {
      name: "nightcore",
      description: "Ative/desative o filtro nightcore"
    },
    vaporwave: {
      name: "vaporwave",
      description: "Ative/desative o filtro vaporwave"
    },
    soft: {
      name: "soft",
      description: "Ative/desative o filtro soft"
    },
    "8d": {
      name: "8d",
      description: "Ative/desative o filtro de \xE1udio 8D"
    },
    karaoke: {
      name: "karaoke",
      description: "Ative/desative o filtro karaok\xEA"
    },
    tremolo: {
      name: "tremolo",
      description: "Ative/desative o filtro tremolo"
    },
    vibrato: {
      name: "vibrato",
      description: "Ative/desative o filtro vibrato"
    },
    distortion: {
      name: "distortion",
      description: "Ative/desative o filtro distortion"
    },
    lowpass: {
      name: "lowpass",
      description: "Ative/desative o filtro lowpass"
    },
    speed: {
      name: "speed",
      description: "Defina a velocidade de reprodu\xE7\xE3o",
      options: {
        value: "Velocidade de 0.5 a 5.0"
      }
    },
    pitch: {
      name: "pitch",
      description: "Defina o tom",
      options: {
        value: "Tom de 0.5 a 5.0"
      }
    },
    eq: {
      name: "eq",
      description: "Defina um equalizador personalizado como 3 0 0 1 0 -1",
      options: {
        bands: "15 ganhos de -1 a 1"
      }
    },
    filters: {
      name: "filters",
      description: "Mostre os filtros ativos"
    },
    filtersreset: {
      name: "reset",
      description: "Redefina todos os filtros"
    },
    settings: {
      name: "settings",
      description: "Mostre as configura\xE7\xF5es do servidor"
    },
    prefix: {
      name: "prefix",
      description: "Defina o prefixo de comandos deste servidor",
      options: {
        prefix: "Novo prefixo, at\xE9 5 caracteres"
      }
    },
    language: {
      name: "language",
      description: "Defina o idioma do bot para este servidor",
      options: {
        language: "Idioma a usar"
      }
    },
    djrole: {
      name: "djrole",
      description: "Gerencie os cargos de DJ",
      subcommands: {
        add: {
          description: "Adicione um cargo de DJ",
          options: {
            role: "O cargo"
          }
        },
        remove: {
          description: "Remova um cargo de DJ",
          options: {
            role: "O cargo"
          }
        },
        list: {
          description: "Liste os cargos de DJ"
        }
      }
    },
    botchannel: {
      name: "botchannel",
      description: "Restrinja comandos de m\xFAsica a canais espec\xEDficos",
      subcommands: {
        add: {
          description: "Permita um canal",
          options: {
            channel: "O canal"
          }
        },
        remove: {
          description: "Vede um canal",
          options: {
            channel: "O canal"
          }
        },
        clear: {
          description: "Permita todos os canais"
        }
      }
    },
    defaultvolume: {
      name: "defaultvolume",
      description: "Defina o volume padr\xE3o deste servidor",
      options: {
        level: "Volume de 0 a 150"
      }
    },
    idletimeout: {
      name: "idletimeout",
      description: "Defina quanto esperar antes de sair quando ocioso",
      options: {
        minutes: "Minutos, 0 para desativar"
      }
    },
    help: {
      name: "help",
      description: "Mostre o menu de ajuda"
    },
    ping: {
      name: "ping",
      description: "Mostre a lat\xEAncia do bot"
    },
    stats: {
      name: "stats",
      description: "Mostre estat\xEDsticas do bot"
    },
    invite: {
      name: "invite",
      description: "Obtenha o link de convite do bot"
    },
    about: {
      name: "about",
      description: "Mostre informa\xE7\xF5es sobre o Slux"
    },
    skipto: {
      description: "Pule para uma faixa espec\xEDfica da fila",
      options: {
        index: "Posi\xE7\xE3o da fila para pular"
      }
    },
    removeduplicates: {
      description: "Remove faixas duplicadas da fila"
    },
    sleep: {
      description: "Pausa a reprodu\xE7\xE3o ap\xF3s um tempo (temporizador)",
      options: {
        minutes: "Minutos at\xE9 a pausa (0 ou off para cancelar)"
      }
    },
    nodes: {
      description: "Mostra o status dos n\xF3s de m\xFAsica"
    },
    developer: {
      description: "Conhe\xE7a o desenvolvedor do Slux"
    }
  },
  music: {
    nowPlaying: "Tocando agora",
    searching: "Pesquisando...",
    added: "**{title}** adicionada \xE0 fila",
    addedAt: "**{title}** adicionada \xE0 posi\xE7\xE3o #{position} da fila",
    addedPlaylist: "**{count}** faixas de **{name}** adicionadas \xE0 fila",
    selectPrompt: "Escolha uma faixa \u2014 resultados para `{query}`",
    selectButton: "Escolher",
    cancelButton: "Cancelar",
    paused: "Player pausado.",
    resumed: "Player retomado.",
    alreadyPaused: "O player j\xE1 est\xE1 pausado.",
    notPaused: "O player n\xE3o est\xE1 pausado.",
    stopped: "Player parado e canal deixado.",
    skipped: "**{title}** pulada.",
    noPrevious: "N\xE3o h\xE1 m\xFAsica anterior.",
    previousNow: "Tocando a m\xFAsica anterior.",
    queueTitle: "Fila de {guild}",
    queueNowPlaying: "**Tocando agora** \u2014 [{title}]({uri}) `{duration}`",
    queueUpNext: "A seguir",
    queueFooter: "{count} faixas \u2022 {duration} no total",
    npLength: "Dura\xE7\xE3o",
    npPosition: "Posi\xE7\xE3o",
    npVolume: "Volume",
    npLoop: "Repeti\xE7\xE3o",
    npFilters: "Filtros",
    live: "AO VIVO",
    stream: "Transmiss\xE3o ao vivo",
    removed: "**{title}** removida da fila.",
    invalidIndex: "N\xE3o h\xE1 faixa na posi\xE7\xE3o #{index}.",
    cleared: "Fila limpa ({count} faixas).",
    moved: "**{title}** movida de #{from} para #{to}.",
    shuffled: "Fila embaralhada ({count} faixas).",
    loopOff: "Repeti\xE7\xE3o agora est\xE1 **desligada**.",
    loopTrack: "Repetindo a **faixa atual**.",
    loopQueue: "Repetindo a **fila**.",
    volumeSet: "Volume definido para **{level}%**.",
    volumeCurrent: "O volume est\xE1 em **{level}%**.",
    seeked: "Pulado para **{position}**.",
    seekInvalid: "Posi\xE7\xE3o inv\xE1lida \u2014 a m\xFAsica tem apenas {length}.",
    forwarded: "Avan\xE7ado para **{position}**.",
    rewound: "Retrocedido para **{position}**.",
    joined: "Entrou em **{channel}**.",
    joinFailed: "N\xE3o consegui entrar nesse canal de voz.",
    replaying: "Re tocando a m\xFAsica atual.",
    grabTitle: "M\xFAsica guardada",
    grabDmed: "Enviei a m\xFAsica atual na sua DM.",
    grabDmFailed: "N\xE3o consegui te enviar DM \u2014 ative DMs de membros do servidor.",
    lyricsTitle: "Letra de {title}",
    lyricsNone: "Nenhuma letra encontrada para a m\xFAsica atual.",
    autoplayOn: "Reprodu\xE7\xE3o autom\xE1tica **ativada** \u2014 continuarei tocando m\xFAsicas relacionadas.",
    autoplayOff: "Reprodu\xE7\xE3o autom\xE1tica **desativada**.",
    stayOn: "Modo 24/7 **ativado** \u2014 ficarei no canal.",
    stayOff: "Modo 24/7 **desativado**.",
    djmodeOn: "Modo DJ **ativado** \u2014 apenas ouvintes no canal de voz podem me controlar.",
    djmodeOff: "Modo DJ **desativado**.",
    djmodeActive: "O modo DJ est\xE1 ativo \u2014 apenas ouvintes no canal de voz podem me controlar.",
    leftIdle: "Sai do canal por inatividade.",
    leftAlone: "Sai do canal porque todos sa\xEDram.",
    notSeekable: "N\xE3o \xE9 poss\xEDvel pular nesta faixa.",
    queueEnded: "A fila terminou.",
    pausedLabel: "Pausado",
    addedTitle: "Adicionado \xE0 fila",
    addedTopTitle: "Adicionado ao topo",
    skipPlayTitle: "Pulando para",
    playlistAddedTitle: "Playlist adicionada",
    queuePosition: "Posi\xE7\xE3o",
    queueTotal: "Fila",
    totalDuration: "Dura\xE7\xE3o total",
    searchResultsTitle: "Resultados da busca",
    selectFooter: "Escolha uma faixa abaixo",
    selectPlaceholder: "Escolha uma faixa\u2026",
    stoppedTitle: "Parado",
    skippedTitle: "Pulada",
    previousTitle: "Faixa anterior",
    queueJumpTo: "Ir para a p\xE1gina\u2026",
    queuePageOption: "P\xE1gina {page}",
    npProgress: "Progresso",
    removedTitle: "Removida",
    clearedTitle: "Fila limpa",
    movedTitle: "Faixa movida",
    shuffledTitle: "Embaralhada",
    loopTitle: "Modo de repeti\xE7\xE3o",
    loopCurrent: "O modo de repeti\xE7\xE3o est\xE1 {mode}",
    loopModeOff: "Off",
    loopModeTrack: "Faixa",
    loopModeQueue: "Fila",
    volumeTitle: "Volume",
    volDown: "Volume \u221210",
    volUp: "Volume +10",
    volMute: "Mudo",
    pausedTitle: "Pausado",
    resumedTitle: "Retomado",
    seekedTitle: "Posi\xE7\xE3o alterada",
    forwardedTitle: "Avan\xE7ado",
    rewoundTitle: "Rebobinado",
    replayingTitle: "Reproduzindo novamente",
    joinedTitle: "Conectado",
    grabSource: "Fonte",
    lyricsSynced: "Sincronizada",
    lyricsPlain: "Simples",
    autoplayLabel: "Reprodu\xE7\xE3o autom\xE1tica",
    djmodeLabel: "Modo DJ",
    ctrlPrevious: "Anterior",
    ctrlPause: "Pausar",
    ctrlResume: "Retomar",
    ctrlSkip: "Pular",
    ctrlLoop: "Repetir",
    ctrlStop: "Parar",
    ctrlShuffle: "Embaralhar",
    ctrlQueue: "Fila",
    ctrlLyrics: "Letra",
    ctrlVolDown: "Vol \u221210",
    ctrlVolUp: "Vol +10",
    engineNotReady: "O motor de m\xFAsica ainda n\xE3o est\xE1 conectado \u2014 o Lavalink ainda est\xE1 iniciando ou est\xE1 inacess\xEDvel. Tente novamente em um minuto (verifique o console do bot).",
    skiptoTitle: "Pulado para a faixa",
    skiptoDone: "Fui direto para a posi\xE7\xE3o {index} \u2014 tudo antes dela foi descartado.",
    removedDuplicatesTitle: "Duplicatas removidas",
    removedDuplicates: "**{count}** faixa(s) duplicada(s) removida(s) da fila.",
    noDuplicates: "Nenhuma faixa duplicada \u2014 sua fila est\xE1 limpa!",
    sleepTitle: "Temporizador",
    sleepSet: "Vou pausar a reprodu\xE7\xE3o em {minutes} minuto(s).",
    sleepCancelled: "Temporizador cancelado.",
    sleepStatus: "A reprodu\xE7\xE3o pausa em {minutes} minuto(s).",
    sleepNone: "Nenhum temporizador definido. Use `sleep <minutos>` para agendar um."
  },
  playlists: {
    created: "Playlist **{name}** criada.",
    deleted: "Playlist **{name}** exclu\xEDda.",
    renamed: "Playlist **{old}** renomeada para **{new}**.",
    notFound: "Voc\xEA n\xE3o tem uma playlist chamada **{name}**.",
    exists: "Voc\xEA j\xE1 tem uma playlist chamada **{name}**.",
    nameTooLong: "Nomes de playlist podem ter no m\xE1ximo 64 caracteres.",
    addedTracks: "**{count}** faixas adicionadas a **{name}**.",
    addedCurrent: "**{title}** adicionada a **{name}**.",
    noCurrent: "Nada est\xE1 tocando \u2014 forne\xE7a um nome ou URL.",
    removedTrack: "**{title}** removida de **{name}**.",
    listTitle: "Suas playlists",
    listEmpty: "Voc\xEA ainda n\xE3o tem playlists.",
    infoTitle: "Playlist: {name}",
    infoFooter: "{count} faixas \u2022 {duration} \u2022 {visibility}",
    public: "P\xFAblica",
    private: "Privada",
    loaded: "**{count}** faixas carregadas de **{name}**.",
    empty: "A playlist **{name}** est\xE1 vazia.",
    limitReached: "Playlists podem ter no m\xE1ximo {limit} faixas.",
    tooManyToAdd: "Isso excederia o limite de {limit} faixas da playlist.",
    favorites: "Favoritos",
    favoritesEmpty: "Voc\xEA ainda n\xE3o tem favoritos.",
    favoritesAdded: "**{title}** adicionada aos seus favoritos.",
    favoritesRemoved: "**{title}** removida dos seus favoritos.",
    favoritesLoaded: "**{count}** favoritos carregados.",
    owner: "Dono",
    createdTitle: "Playlist criada",
    deletedTitle: "Playlist exclu\xEDda",
    renamedTitle: "Playlist renomeada",
    addedTitle: "Faixa adicionada",
    removedTrackTitle: "Faixa removida",
    visibilityTitle: "Visibilidade alterada",
    loadedTitle: "Playlist carregada",
    savedQueueTitle: "Fila salva",
    savedQueue: "Fila atual ({count} faixas) salva na playlist **{name}**.",
    savedQueueUpdated: "Playlist **{name}** atualizada com a fila atual ({count} faixas).",
    nothingToSave: "Nada est\xE1 tocando \u2014 n\xE3o h\xE1 fila para salvar."
  },
  filters: {
    applied: "Filtro **{name}** aplicado.",
    removed: "Filtro **{name}** removido.",
    reset: "Todos os filtros foram redefinidos.",
    listTitle: "Filtros ativos",
    listNone: "Nenhum filtro est\xE1 ativo.",
    invalidLevel: "O n\xEDvel deve ser: low, medium, high ou insane.",
    invalidValue: "O valor deve estar entre {min} e {max}.",
    eqApplied: "Equalizador personalizado aplicado.",
    eqUsage: "Uso: `{prefix}eq <15 ganhos de -1 a 1>` \u2014 ex. `{prefix}eq 0.3 0.3 0.2 0 -0.2 0 0 0 0 0 0 0 0 0 0`",
    appliedTitle: "Filtro aplicado",
    removedTitle: "Filtro removido",
    resetTitle: "Filtros redefinidos",
    resetAll: "Redefinir filtros",
    openPanel: "Painel de filtros",
    panelTitle: "Filtros de \xE1udio",
    panelHint: "Escolha um filtro para ativar ou desativar \u2014 mudan\xE7as instant\xE2neas.",
    pickPlaceholder: "Alternar um filtro\u2026",
    stateOn: "SIM \u2014 selecione para desativar",
    stateOff: "N\xC3O \u2014 selecione para ativar"
  },
  settings: {
    "247": "24/7 padr\xE3o",
    title: "Configura\xE7\xF5es de {guild}",
    prefix: "Prefixo",
    language: "Idioma",
    djRoles: "Cargos de DJ",
    botChannels: "Canais permitidos",
    defaultVolume: "Volume padr\xE3o",
    autoplay: "Autoplay padr\xE3o",
    idleTimeout: "Tempo de inatividade",
    allChannels: "Todos os canais",
    noTimeout: "Desativado",
    prefixSet: "Prefixo definido para `{prefix}`.",
    prefixInvalid: "O prefixo deve ter 1-5 caracteres e n\xE3o pode conter espa\xE7os.",
    languageSet: "Idioma definido para **{language}**.",
    languageInvalid: "Idiomas dispon\xEDveis: {languages}.",
    djRoleAdded: "**{role}** agora \xE9 um cargo de DJ.",
    djRoleRemoved: "**{role}** n\xE3o \xE9 mais um cargo de DJ.",
    djRoleNotSet: "**{role}** n\xE3o \xE9 um cargo de DJ.",
    djRoleList: "Cargos de DJ: {roles}",
    djRoleNone: "Nenhum cargo de DJ definido.",
    botChannelAdded: "Comandos de m\xFAsica agora est\xE3o restritos a **{channel}**.",
    botChannelRemoved: "**{channel}** foi removido dos canais permitidos.",
    botChannelNotSet: "**{channel}** n\xE3o est\xE1 nos canais permitidos.",
    botChannelCleared: "Comandos de m\xFAsica agora s\xE3o permitidos em todos os canais.",
    defaultVolumeSet: "Volume padr\xE3o definido para **{level}%**.",
    idleTimeoutSet: "Tempo de inatividade definido para **{minutes}** minutos.",
    idleTimeoutDisabled: "Tempo de inatividade desativado \u2014 ficarei at\xE9 ser parado."
  },
  info: {
    helpTitle: "Slux \u2014 Ajuda",
    helpDescription: "Um bot de m\xFAsica repleto de recursos. Use comandos de barra ou `{prefix}` como prefixo.",
    helpFields: {
      music: "M\xFAsica",
      playlists: "Playlists",
      filters: "Filtros",
      settings: "Configura\xE7\xF5es",
      info: "Informa\xE7\xF5es"
    },
    helpFooter: "Veja todos os comandos no painel",
    pingTitle: "Pong!",
    pingWebsocket: "Websocket",
    pingRoundtrip: "Ida e volta",
    pingLavalink: "Lavalink",
    statsTitle: "Slux \u2014 Estat\xEDsticas",
    statsServers: "Servidores",
    statsPlayers: "Players ativos",
    statsUsers: "Usu\xE1rios",
    statsUptime: "Uptime",
    statsMemory: "Mem\xF3ria",
    statsNode: "N\xF3 Lavalink",
    statsNodePenalties: "Penalidades do n\xF3",
    inviteTitle: "Convidar o Slux",
    inviteDescription: "Clique no bot\xE3o abaixo para adicionar o Slux ao seu servidor.",
    aboutTitle: "Sobre o Slux",
    aboutDescription: "Slux \xE9 um bot de m\xFAsica do Discord gratuito e repleto de recursos com Spotify, YouTube, SoundCloud, Deezer, Apple Music e mais \u2014 com um painel web em tempo real.",
    aboutFooter: "Feito com \u2665 \u2014 gr\xE1tis para sempre, sem n\xEDveis premium",
    helpPickCategory: "Escolha uma categoria de comandos\u2026",
    helpCategoryCount: "{count} comandos",
    helpAndMore: "+{count} mais",
    helpCommandsTitle: "Comandos",
    pingStatus: "Status da conex\xE3o",
    inviteButton: "Convidar Slux",
    dashboardButton: "Abrir painel",
    aboutSources: "Fontes",
    aboutFeatures: "Destaques",
    nodesTitle: "N\xF3s de m\xFAsica",
    nodesActive: "N\xF3 ativo: {name}",
    nodeConnected: "Conectado",
    nodeConnecting: "Conectando\u2026",
    nodeDisconnecting: "Desconectando\u2026",
    nodeDisconnected: "Desconectado",
    nodePlayers: "Players",
    nodeCpu: "CPU",
    developerTitle: "Feito por SHM",
    developerDescription: "O Slux \xE9 projetado, constru\xEDdo e mantido por **SHM**. Cada recurso \u2014 o motor de reprodu\xE7\xE3o, filtros, painel e letras \u2014 \xE9 feito com carinho.",
    developerRole: "Criador e desenvolvedor",
    developerWorkTitle: "O projeto",
    developerWork: "Siga **@Letzforge** no YouTube por v\xEDdeos de cria\xE7\xE3o, dev logs e tutoriais de projetos como este.",
    developerFooter: "Feito com \u2764\uFE0F por SHM"
  },
  dashboard: {
    nav: {
      player: "Player",
      settings: "Configura\xE7\xF5es",
      playlists: "Playlists",
      backToSite: "Voltar ao site",
      logout: "Sair",
      dashboard: "Painel",
      commands: "Comandos",
      theme: "Tema"
    },
    landing: {
      badge: "Gr\xE1tis para sempre \u2014 sem premium",
      title: "M\xFAsica que nunca perde o ritmo",
      subtitle: "Slux \xE9 um bot de m\xFAsica do Discord repleto de recursos com suporte a Spotify, YouTube, SoundCloud, Deezer e Apple Music \u2014 mais um painel em tempo real para controlar tudo pelo navegador.",
      addDiscord: "Adicionar ao Discord",
      openDashboard: "Abrir painel",
      featuresTitle: "Tudo o que voc\xEA precisa",
      featuresSubtitle: "Todos os recursos, gr\xE1tis para todos. Essa \xE9 a promessa do Slux.",
      sourcesTitle: "Todas as suas fontes",
      sourcesDescription: "Pesquise e toque do Spotify, YouTube, SoundCloud, Deezer, Apple Music, Tidal e YouTube Music.",
      filtersTitle: "Filtros de est\xFAdio",
      filtersDescription: "Bassboost, nightcore, vaporwave, 8D, karaok\xEA e um equalizador completo de 15 bandas.",
      playlistsTitle: "Playlists poderosas",
      playlistsDescription: "Salve suas faixas favoritas, importe playlists e carregue-as com um comando.",
      lyricsTitle: "Letras sincronizadas",
      lyricsDescription: "Acompanhe a letra no Discord ou no painel com letras sincronizadas.",
      dashboardTitle: "Painel em tempo real",
      dashboardDescription: "Controle a reprodu\xE7\xE3o, gerencie a fila e configure o bot pelo navegador.",
      autoplayTitle: "Autoplay e 24/7",
      autoplayDescription: "O Slux mant\xE9m a m\xFAsica tocando com faixas relacionadas e pode ficar no canal o dia todo.",
      i18nTitle: "Fala seu idioma",
      i18nDescription: "Ingl\xEAs, h\xEDndi, espanhol, franc\xEAs, alem\xE3o e portugu\xEAs inclusos.",
      statsServers: "servidores",
      statsPlayers: "players ativos",
      statsTracks: "faixas tocadas",
      ctaTitle: "Pronto para melhorar o som do seu servidor?",
      ctaSubtitle: "Adicione o Slux em menos de um minuto. Sem configura\xE7\xE3o, sem premium, sem limites."
    },
    commands: {
      title: "Comandos",
      subtitle: "Tudo o que o Slux pode fazer \u2014 em {count} comandos",
      search: "Pesquisar comandos...",
      noResults: "Nenhum comando corresponde \xE0 sua pesquisa.",
      usage: "Uso"
    },
    guilds: {
      title: "Seus servidores",
      subtitle: "Escolha um servidor para gerenciar",
      invite: "Convidar",
      manage: "Gerenciar",
      empty: "Nenhum servidor com permiss\xE3o de Gerenciar Servidor encontrado."
    },
    settings: {
      title: "Configura\xE7\xF5es",
      general: "Geral",
      playback: "Reprodu\xE7\xE3o",
      dj: "DJ",
      prefix: "Prefixo de comandos",
      prefixDescription: "Prefixo para comandos de texto",
      language: "Idioma",
      languageDescription: "Idioma das respostas do bot",
      defaultVolume: "Volume padr\xE3o",
      defaultVolumeDescription: "Volume ao iniciar o player",
      autoplay: "Autoplay",
      autoplayDescription: "Continuar tocando faixas relacionadas quando a fila acabar",
      stay247: "Modo 24/7",
      stay247Description: "Ficar no canal de voz quando sozinho ou ocioso",
      idleTimeout: "Tempo de inatividade",
      idleTimeoutDescription: "Sair ap\xF3s estes minutos de inatividade (0 = nunca)",
      djRoles: "Cargos de DJ",
      djRolesDescription: "Cargos que podem usar comandos de DJ",
      botChannels: "Canais permitidos",
      botChannelsDescription: "Restringir comandos de m\xFAsica a estes canais",
      allChannels: "Todos os canais permitidos",
      save: "Salvar altera\xE7\xF5es",
      saved: "Configura\xE7\xF5es salvas",
      saveFailed: "Falha ao salvar as configura\xE7\xF5es",
      notAvailable: "Servidor indispon\xEDvel \u2014 o bot est\xE1 nele?"
    },
    player: {
      title: "Player",
      notConnected: "N\xE3o conectado",
      notConnectedDescription: "O Slux n\xE3o est\xE1 em um canal de voz. Escolha um canal para come\xE7ar a ouvir.",
      join: "Entrar no canal",
      nowPlaying: "Tocando agora",
      nothingPlaying: "Nada tocando",
      queue: "Fila",
      queueEmpty: "A fila est\xE1 vazia \u2014 pesquise algo!",
      lyrics: "Letra",
      noLyrics: "Nenhuma letra dispon\xEDvel para esta faixa.",
      searchPlaceholder: "Pesquise ou cole um link...",
      play: "Tocar",
      pause: "Pausar",
      resume: "Retomar",
      previous: "Anterior",
      skip: "Pular",
      stop: "Parar",
      shuffle: "Embaralhar",
      loop: "Repetir",
      volume: "Volume",
      autoplay: "Autoplay",
      clear: "Limpar fila",
      remove: "Remover",
      moveTop: "Mover ao topo",
      added: "Adicionada \xE0 fila",
      live: "AO VIVO",
      lyricsSynced: "Sincronizada",
      lyricsPlain: "Simples",
      autoScroll: "Rolagem autom\xE1tica",
      history: "Hist\xF3rico",
      historyEmpty: "O hist\xF3rico est\xE1 vazio.",
      replay: "Tocar novamente",
      filtersTab: "Filtros",
      filtersNone: "Nenhum filtro ativo.",
      filtersReset: "Redefinir filtros",
      seekHint: "Arraste para buscar",
      requestedBy: "Pedida por",
      playingIn: "Tocando em",
      realtimeOff: "Tempo real desconectado"
    },
    playlists: {
      title: "Suas playlists",
      subtitle: "Suas cole\xE7\xF5es salvas, dispon\xEDveis em qualquer servidor",
      create: "Nova playlist",
      createTitle: "Criar uma playlist",
      namePlaceholder: "Nome da playlist",
      descriptionPlaceholder: "Descri\xE7\xE3o (opcional)",
      createCta: "Criar",
      delete: "Excluir playlist",
      deleteConfirm: 'Excluir a playlist "{name}"? Isso n\xE3o pode ser desfeito.',
      public: "P\xFAblica",
      private: "Privada",
      tracks: "faixas",
      empty: "Ainda sem playlists \u2014 crie a primeira!",
      loadToGuild: "Tocar em um servidor",
      removeTrack: "Remover faixa",
      created: "Playlist criada",
      deleted: "Playlist exclu\xEDda",
      emptyPlaylist: "Esta playlist est\xE1 vazia."
    },
    auth: {
      login: "Entrar com Discord",
      loginRequired: "Login necess\xE1rio",
      loginRequiredDescription: "Voc\xEA precisa entrar com Discord para acessar o painel."
    },
    user: {
      loggedInAs: "Conectado como"
    }
  }
};

// src/i18n/index.ts
var LOCALES = [
  { code: "en", label: "English", flag: "\u{1F1EC}\u{1F1E7}", discord: "en-US" },
  { code: "hi", label: "\u0939\u093F\u0928\u094D\u0926\u0940", flag: "\u{1F1EE}\u{1F1F3}", discord: "hi" },
  { code: "es", label: "Espa\xF1ol", flag: "\u{1F1EA}\u{1F1F8}", discord: "es-ES" },
  { code: "fr", label: "Fran\xE7ais", flag: "\u{1F1EB}\u{1F1F7}", discord: "fr" },
  { code: "de", label: "Deutsch", flag: "\u{1F1E9}\u{1F1EA}", discord: "de" },
  { code: "pt", label: "Portugu\xEAs", flag: "\u{1F1E7}\u{1F1F7}", discord: "pt-BR" }
];
var LOCALE_CODES = LOCALES.map((l) => l.code);
var bundles = { en: en_default, hi: hi_default, es: es_default, fr: fr_default, de: de_default, pt: pt_default };
function lookup(obj, key) {
  let current = obj;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return void 0;
    current = current[part];
  }
  return current;
}
function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (match, name) => vars[name] !== void 0 ? String(vars[name]) : match
  );
}
var missingLogged = /* @__PURE__ */ new Set();
function t(locale, key, vars) {
  let raw = lookup(bundles[locale] ?? bundles.en, key);
  if (typeof raw !== "string") {
    if (locale !== "en" && !missingLogged.has(`${locale}:${key}`)) {
      missingLogged.add(`${locale}:${key}`);
      if (process.env.NODE_ENV === "development") {
        console.warn(`[i18n] missing key "${key}" in locale "${locale}", falling back to en`);
      }
    }
    raw = lookup(bundles.en, key);
  }
  if (typeof raw !== "string") return key;
  return interpolate(raw, vars);
}
function createTranslator(locale) {
  return (key, vars) => t(locale, key, vars);
}
function normalizeLocale(value) {
  if (!value) return "en";
  const base = value.split("-")[0].toLowerCase();
  return LOCALE_CODES.includes(base) ? base : "en";
}

// src/db/repositories/guilds.ts
import mongoose2 from "mongoose";

// src/db/models/Guild.ts
import mongoose, { Schema, model } from "mongoose";
var guildSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    prefix: { type: String, default: "!" },
    language: {
      type: String,
      enum: ["en", "hi", "es", "fr", "de", "pt"],
      default: "en"
    },
    djRoles: { type: [String], default: [] },
    botChannels: { type: [String], default: [] },
    defaultVolume: { type: Number, min: 0, max: 150, default: 100 },
    defaultAutoplay: { type: Boolean, default: false },
    default247: { type: Boolean, default: false },
    idleTimeout: { type: Number, min: 0, max: 120, default: 5 },
    /** True once the welcome/thanks message was sent for this guild. */
    welcomed: { type: Boolean, default: false }
  },
  { timestamps: true }
);
var GuildModel = mongoose.models.Guild ?? model("Guild", guildSchema);

// src/db/repositories/guilds.ts
var cache = /* @__PURE__ */ new Map();
var CACHE_TTL = 3e4;
var expiry = /* @__PURE__ */ new Map();
var DEFAULT_GUILD_SETTINGS = {
  prefix: "!",
  language: "en",
  djRoles: [],
  botChannels: [],
  defaultVolume: 100,
  defaultAutoplay: false,
  default247: false,
  idleTimeout: 5,
  welcomed: false
};
function defaultsFor(guildId) {
  return { ...DEFAULT_GUILD_SETTINGS, id: guildId };
}
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("database timeout")), ms);
      timer.unref?.();
    })
  ]);
}
function dbReady() {
  return mongoose2.connection.readyState === 1;
}
async function getGuildSettings(guildId) {
  const now = Date.now();
  const cachedAt = expiry.get(guildId) ?? 0;
  if (cache.has(guildId) && now - cachedAt < CACHE_TTL) {
    return cache.get(guildId);
  }
  if (!dbReady()) {
    console.warn("[slux] Database not connected \u2014 using default guild settings");
    return cache.get(guildId) ?? defaultsFor(guildId);
  }
  try {
    let doc = await withTimeout(GuildModel.findOne({ id: guildId }).lean(), 3e3);
    if (!doc) {
      const created = await withTimeout(GuildModel.create({ id: guildId }), 3e3);
      doc = created.toObject();
    }
    cache.set(guildId, doc);
    expiry.set(guildId, now);
    return doc;
  } catch (err) {
    console.warn(
      `[slux] Guild settings unavailable (${err instanceof Error ? err.message : String(err)}) \u2014 using defaults`
    );
    return cache.get(guildId) ?? defaultsFor(guildId);
  }
}
async function updateGuildSettings(guildId, patch) {
  if (!dbReady()) {
    throw new Error("database unavailable \u2014 try again in a moment");
  }
  const doc = await GuildModel.findOneAndUpdate({ id: guildId }, { $set: patch }, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true
  }).lean();
  cache.set(guildId, doc);
  expiry.set(guildId, Date.now());
  return doc;
}
function invalidateGuildCache(guildId) {
  cache.delete(guildId);
  expiry.delete(guildId);
}

// src/bot/music/GuildPlayer.ts
var HISTORY_LIMIT = 50;
var MAX_QUEUE = 500;
function trackFromShoukaku(track, requester) {
  return {
    encoded: track.encoded,
    title: track.info.title,
    author: track.info.author,
    length: track.info.length,
    uri: track.info.uri ?? "",
    artwork: track.info.artworkUrl ?? "",
    sourceName: track.info.sourceName,
    identifier: track.info.identifier,
    isrc: track.info.isrc ?? "",
    isStream: track.info.isStream,
    isSeekable: track.info.isSeekable,
    requesterId: requester?.id ?? "autoplay",
    requesterTag: requester?.tag ?? "Autoplay",
    requesterAvatar: requester?.avatar ?? ""
  };
}
var GuildPlayer = class {
  guildId;
  client;
  player;
  queue = [];
  history = [];
  current = null;
  repeat = "off";
  shuffle = false;
  autoplay = false;
  stayInChannel = false;
  djMode = false;
  volume = 100;
  activeFilters = {};
  events;
  idleTimer = null;
  idleTimeoutMinutes = 5;
  destroyReason = null;
  constructor(guildId, client, player, events) {
    this.guildId = guildId;
    this.client = client;
    this.player = player;
    this.events = events;
    this.bindPlayerEvents();
  }
  bindPlayerEvents() {
    const guard = (label, fn) => {
      try {
        const result = fn();
        if (result instanceof Promise) result.catch((err) => this.logHandlerError(label, err));
      } catch (err) {
        this.logHandlerError(label, err);
      }
    };
    this.player.on(
      "start",
      (data) => guard("start", () => {
        const track = this.current ?? this.queue.find((t2) => t2.encoded === data.track.encoded) ?? null;
        if (track) {
          this.current = track;
          this.history = [track, ...this.history].slice(0, HISTORY_LIMIT);
        }
        this.resetIdleTimer();
        this.events.onTrackStart?.(this.guildId, this.current ?? trackFromShoukaku(data.track));
        this.emit();
      })
    );
    this.player.on(
      "end",
      (data) => guard("end", () => {
        if (this.destroyReason) return;
        if (data.reason === "replaced") return;
        if (data.reason === "stopped") {
          return;
        }
        if (String(data.reason).toLowerCase().includes("load")) return;
        void this.handleTrackEnd();
      })
    );
    this.player.on(
      "exception",
      (data) => guard("exception", () => {
        console.error(
          `[slux] player exception in guild ${this.guildId}:`,
          data.exception?.message ?? String(data.exception)
        );
        void this.handleTrackFailure();
      })
    );
    this.player.on(
      "stuck",
      () => guard("stuck", () => {
        void this.playNext();
      })
    );
    this.player.on(
      "update",
      (data) => guard("update", () => {
        if (data.state?.connected) this.emitThrottled();
      })
    );
    this.player.on(
      "closed",
      () => guard("closed", () => {
        void this.destroy("voice closed");
      })
    );
  }
  logHandlerError(label, err) {
    console.error(
      `[slux] player "${label}" handler error in guild ${this.guildId}:`,
      err instanceof Error ? err.stack ?? err.message : err
    );
  }
  lastEmit = 0;
  emitThrottled() {
    const now = Date.now();
    if (now - this.lastEmit < 900) return;
    this.lastEmit = now;
    this.emit();
  }
  // ── Dashboard heartbeat ──────────────────────────────────────────
  /**
   * While a track is playing, push a fresh snapshot to the dashboard every
   * 3 seconds: song position/duration and full player state stay live even
   * if an Lavalink update or state-change event is missed, and any client
   * interpolation drift self-corrects. Idle/paused players stay silent
   * (nothing changes while paused — the position is frozen).
   */
  heartbeat = null;
  startHeartbeat() {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      if (this.current && !this.player.paused) this.emit();
    }, 3e3);
    this.heartbeat.unref?.();
  }
  stopHeartbeat() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }
  emit() {
    this.startHeartbeat();
    this.events.onSnapshot?.(this.snapshot());
  }
  snapshot() {
    const guild = this.client.guilds.cache.get(this.guildId);
    const connection = this.client.shoukaku?.connections.get(this.guildId);
    let channelName = null;
    if (connection?.channelId) {
      const ch = guild?.channels.cache.get(connection.channelId);
      channelName = ch?.name ?? null;
    }
    return {
      guildId: this.guildId,
      guildName: guild?.name ?? "",
      connected: !!connection,
      channelId: connection?.channelId ?? null,
      channelName,
      playing: !!this.current && !this.player.paused,
      paused: this.player.paused,
      position: this.player.position,
      updatedAt: Date.now(),
      track: this.current,
      queue: this.queue,
      history: this.history.slice(0, 20),
      repeat: this.repeat,
      shuffle: this.shuffle,
      autoplay: this.autoplay,
      stayInChannel: this.stayInChannel,
      volume: this.volume,
      filters: activeFilterNames(this.player.filters),
      djMode: this.djMode
    };
  }
  // ── Queue operations ─────────────────────────────────────────────
  enqueue(track, position) {
    if (position === void 0 || position >= this.queue.length) {
      this.queue.push(track);
    } else {
      this.queue.splice(Math.max(0, position), 0, track);
    }
    if (this.queue.length > MAX_QUEUE) this.queue = this.queue.slice(0, MAX_QUEUE);
    this.emit();
  }
  enqueueMany(tracks, position) {
    const room = MAX_QUEUE - this.queue.length;
    const toAdd = tracks.slice(0, Math.max(0, room));
    if (position === void 0 || position >= this.queue.length) {
      this.queue.push(...toAdd);
    } else {
      this.queue.splice(Math.max(0, position), 0, ...toAdd);
    }
    this.emit();
  }
  async startIfIdle() {
    if (!this.current && this.queue.length > 0) {
      await this.playNext();
    }
  }
  async handleTrackEnd() {
    if (this.repeat === "track" && this.current) {
      await this.playTrack(this.current);
      return;
    }
    if (this.repeat === "queue" && this.current) {
      this.queue.push(this.current);
    }
    if (this.queue.length > 0) {
      await this.playNext();
      return;
    }
    if (this.autoplay) {
      const injected = await this.fetchAutoplayTrack();
      if (injected) {
        injected.fromAutoplay = true;
        this.queue.push(injected);
        await this.playNext();
        return;
      }
    }
    this.current = null;
    this.emit();
    this.startIdleTimer();
  }
  /**
   * A track failed mid-playback. Most commonly the playback mirror (YouTube)
   * is login-walled on the server's IP. Attempt one automatic SoundCloud
   * rescue for any non-SoundCloud track before giving up and skipping.
   */
  failureInProgress = false;
  async handleTrackFailure() {
    if (this.destroyReason || this.failureInProgress) return;
    this.failureInProgress = true;
    try {
      const failed = this.current;
      if (failed && !failed.rescueAttempted && failed.sourceName !== "soundcloud") {
        const rescued = await this.rescueViaSoundCloud(failed);
        if (rescued) {
          rescued.rescueAttempted = true;
          rescued.fromRescue = true;
          await this.playTrack(rescued);
          return;
        }
      }
      await this.playNext();
    } catch (err) {
      this.logHandlerError("trackFailure", err);
      await this.playNext().catch(() => {
      });
    } finally {
      this.failureInProgress = false;
    }
  }
  /** Re-resolve a failed YouTube track on SoundCloud, keeping requester info. */
  async rescueViaSoundCloud(track) {
    try {
      const cleaned = `${track.title} ${track.author}`.replace(/[([](official|lyrics?|audio|video|hd|4k|remaster\w*|explicit|mv|visualizer)[^)\]]*[)\]]/gi, "").replace(/\s*[-–|]\s*(official|topic)\s*$/i, "").replace(/\s+/g, " ").trim();
      const res = await this.player.node.rest.resolve(`scsearch:${cleaned}`);
      if (res?.loadType === "search" && res.data.length > 0) {
        const artist = track.author.toLowerCase().split(/\s*[-–]\s*/)[0]?.trim();
        const sameArtist = artist ? res.data.find((t2) => t2.info.author.toLowerCase().includes(artist)) : void 0;
        const pick = sameArtist ?? res.data[0];
        if (!pick) return null;
        console.log(
          `[slux] Rescued "${track.title}" via SoundCloud: "${pick.info.title}" by ${pick.info.author}`
        );
        return trackFromShoukaku(pick, {
          id: track.requesterId,
          tag: track.requesterTag,
          avatar: track.requesterAvatar
        });
      }
      return null;
    } catch (err) {
      console.error(`[slux] SoundCloud rescue failed in ${this.guildId}:`, err);
      return null;
    }
  }
  async playNext() {
    const next = this.queue.shift();
    if (!next) {
      this.current = null;
      this.emit();
      this.startIdleTimer();
      return;
    }
    await this.playTrack(next);
  }
  async playTrack(track) {
    this.current = track;
    try {
      await this.player.playTrack({ track: { encoded: track.encoded } });
    } catch (err) {
      console.error(`[slux] playTrack failed in ${this.guildId}:`, err);
      await this.playNext();
    }
  }
  // ── Controls ─────────────────────────────────────────────────────
  async skip() {
    const skipped = this.current;
    await this.playNext();
    this.emit();
    return skipped;
  }
  async previous() {
    const prev = this.history[1] ?? this.history[0];
    if (!prev) return null;
    const toPlay = { ...prev, requesterId: this.current?.requesterId ?? prev.requesterId };
    if (this.current) this.queue.unshift(this.current);
    await this.playTrack(toPlay);
    this.emit();
    return toPlay;
  }
  async pause() {
    if (this.player.paused) return;
    await this.player.setPaused(true);
    this.emit();
  }
  async resume() {
    if (!this.player.paused) return;
    await this.player.setPaused(false);
    this.emit();
  }
  get paused() {
    return this.player.paused;
  }
  async setVolume(volume) {
    this.volume = Math.max(0, Math.min(150, Math.round(volume)));
    await this.player.setGlobalVolume(this.volume);
    this.emit();
  }
  async seek(positionMs) {
    if (!this.current || !this.current.isSeekable) return false;
    const clamped = Math.max(0, Math.min(this.current.length, positionMs));
    await this.player.seekTo(clamped);
    this.emit();
    return true;
  }
  async setRepeat(mode) {
    this.repeat = mode;
    this.emit();
  }
  cycleRepeat() {
    const next = this.repeat === "off" ? "track" : this.repeat === "track" ? "queue" : "off";
    void this.setRepeat(next);
    return next;
  }
  toggleShuffle() {
    this.shuffle = !this.shuffle;
    if (this.shuffle) this.shuffleQueue();
    return this.shuffle;
  }
  shuffleQueue() {
    const count = this.queue.length;
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.emit();
    return count;
  }
  removeAt(index) {
    if (index < 1 || index > this.queue.length) return null;
    const [removed] = this.queue.splice(index - 1, 1);
    this.emit();
    return removed ?? null;
  }
  moveTrack(from, to) {
    if (from < 1 || from > this.queue.length || to < 1 || to > this.queue.length || from === to) return null;
    const [track] = this.queue.splice(from - 1, 1);
    if (!track) return null;
    this.queue.splice(to - 1, 0, track);
    this.emit();
    return track;
  }
  clearQueue() {
    const count = this.queue.length;
    this.queue = [];
    this.emit();
    return count;
  }
  /** Skip to a queue position (1-based), dropping everything before it.
   *  Returns the track jumped to, or null when the index is out of range. */
  skipTo(index) {
    if (index < 1 || index > this.queue.length) return null;
    const target = this.queue[index - 1];
    if (index > 1) this.queue.splice(0, index - 1);
    void this.skip();
    return target;
  }
  /** Drop duplicate tracks from the queue (by encoded id). Returns how many were removed. */
  removeDuplicates() {
    const seen = /* @__PURE__ */ new Set();
    const deduped = this.queue.filter((track) => {
      if (seen.has(track.encoded)) return false;
      seen.add(track.encoded);
      return true;
    });
    const removed = this.queue.length - deduped.length;
    if (removed > 0) {
      this.queue = deduped;
      this.emit();
    }
    return removed;
  }
  // ── Sleep timer ──────────────────────────────────────────────────
  sleepTimer = null;
  sleepTimerUntil = null;
  /** Pause playback after `minutes` (<= 0 cancels). Returns the deadline or null. */
  setSleepTimer(minutes) {
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }
    if (!(minutes > 0)) {
      this.sleepTimerUntil = null;
      this.emit();
      return null;
    }
    const until = Date.now() + minutes * 6e4;
    this.sleepTimerUntil = until;
    this.sleepTimer = setTimeout(() => {
      this.sleepTimer = null;
      this.sleepTimerUntil = null;
      void this.pause().then(() => this.emit());
    }, minutes * 6e4);
    this.sleepTimer.unref?.();
    this.emit();
    return until;
  }
  // ── Filters ──────────────────────────────────────────────────────
  async applyFilter(name, value) {
    this.activeFilters[name] = value === void 0 ? true : value;
    await this.pushFilters();
  }
  async removeFilter(name) {
    if (!(name in this.activeFilters)) return false;
    delete this.activeFilters[name];
    await this.pushFilters();
    return true;
  }
  hasFilter(name) {
    return name in this.activeFilters;
  }
  async resetFilters() {
    this.activeFilters = {};
    await this.player.clearFilters();
    this.emit();
  }
  getFilterValue(name) {
    return this.activeFilters[name];
  }
  async pushFilters() {
    const filters = buildFilters(this.activeFilters);
    await this.player.setFilters(filters);
    this.emit();
  }
  // ── Autoplay ─────────────────────────────────────────────────────
  recentAutoplayKeys = [];
  async fetchAutoplayTrack() {
    const seed = this.current ?? this.history[0] ?? this.queue[0];
    if (!seed) return null;
    try {
      const node = this.player.node;
      let tracks = [];
      if (seed.sourceName === "spotify" && seed.identifier) {
        const res = await node.rest.resolve(`sprec:mix:track:${seed.identifier}`);
        if (res?.loadType === "playlist") tracks = res.data.tracks;
      }
      if (tracks.length === 0 && seed.sourceName === "youtube" && seed.identifier) {
        const res = await node.rest.resolve(
          `https://www.youtube.com/watch?v=${seed.identifier}&list=RD${seed.identifier}`
        );
        if (res?.loadType === "playlist") tracks = res.data.tracks;
      }
      if (tracks.length === 0) {
        const scRes = await node.rest.resolve(`scsearch:${seed.author}`);
        if (scRes?.loadType === "search") tracks = scRes.data;
      }
      if (tracks.length === 0) {
        const query = seed.isrc ? `ytsearch:"${seed.isrc}"` : `ytsearch:${seed.author}`;
        const res = await node.rest.resolve(query);
        if (res?.loadType === "search") tracks = res.data;
      }
      const candidates = tracks.filter((t2) => {
        const key = `${t2.info.identifier}:${t2.info.sourceName}`;
        return !this.recentAutoplayKeys.includes(key) && t2.info.identifier !== seed.identifier && t2.info.title !== seed.title;
      });
      if (candidates.length === 0) return null;
      const pick = candidates[Math.floor(Math.random() * Math.min(8, candidates.length))];
      this.recentAutoplayKeys = [
        `${pick.info.identifier}:${pick.info.sourceName}`,
        ...this.recentAutoplayKeys
      ].slice(0, 30);
      return trackFromShoukaku(pick);
    } catch (err) {
      console.error(`[slux] autoplay failed in ${this.guildId}:`, err);
      return null;
    }
  }
  // ── Voice / lifecycle ────────────────────────────────────────────
  get voiceChannel() {
    const connection = this.client.shoukaku?.connections.get(this.guildId);
    if (!connection?.channelId) return null;
    const guild = this.client.guilds.cache.get(this.guildId);
    return guild?.channels.cache.get(connection.channelId) ?? null;
  }
  listenerCount() {
    const channel = this.voiceChannel;
    if (!channel) return 0;
    return channel.members.filter((m) => !m.user.bot).size;
  }
  setIdleTimeout(minutes) {
    this.idleTimeoutMinutes = minutes;
    this.resetIdleTimer();
  }
  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.idleTimeoutMinutes <= 0) return;
    if (!this.current || this.player.paused) {
      this.startIdleTimer();
    }
  }
  startIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.idleTimeoutMinutes <= 0 || this.stayInChannel || this.queue.length > 0) return;
    if (this.current && !this.player.paused) return;
    this.idleTimer = setTimeout(
      () => {
        void this.leaveDueTo("idle");
      },
      this.idleTimeoutMinutes * 60 * 1e3
    );
    this.idleTimer.unref?.();
  }
  async leaveDueTo(reason) {
    const channel = this.textChannel;
    if (channel && "send" in channel && typeof channel.send === "function") {
      try {
        await this.refreshLocale();
        const { t: t2 } = this.localeContext();
        await channel.send({
          content: reason === "alone" ? t2("music.leftAlone") : t2("music.leftIdle")
        });
      } catch {
      }
    }
    await this.destroy(reason);
  }
  /** The bound text channel (set when a command first creates the player). */
  textChannel = null;
  textChannelId = null;
  bindTextChannel(channel) {
    this.textChannel = channel;
    this.textChannelId = channel.id;
  }
  localeContext() {
    return {
      t: (key, vars) => t(this.effectiveLocale, key, vars),
      locale: this.effectiveLocale
    };
  }
  effectiveLocale = "en";
  async refreshLocale() {
    try {
      const settings = await getGuildSettings(this.guildId);
      this.effectiveLocale = normalizeLocale(settings.language);
    } catch {
      this.effectiveLocale = "en";
    }
  }
  async destroy(reason) {
    if (this.destroyReason) return;
    this.destroyReason = reason;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.stopHeartbeat();
    this.queue = [];
    this.history = [];
    this.current = null;
    try {
      await this.player.destroy();
    } catch {
    }
    this.events.onDestroy?.(this.guildId, reason);
  }
  // ── Display helpers ──────────────────────────────────────────────
  get progressText() {
    if (!this.current) return "";
    if (this.current.isStream) return "LIVE";
    return `${formatDuration(this.player.position)} / ${formatDuration(this.current.length)}`;
  }
};

// src/lib/env.ts
import { z } from "zod";
function boolFlag(defaultValue) {
  return z.preprocess(
    (raw) => {
      if (raw === void 0 || raw === null || raw === "") return defaultValue;
      if (typeof raw === "boolean") return raw;
      const s = String(raw).trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(s)) return true;
      if (["0", "false", "no", "off"].includes(s)) return false;
      return defaultValue;
    },
    z.boolean()
  );
}
var optionalHost = z.string().trim().optional().transform((v) => v && v.length > 0 ? v : void 0);
var optionalUrl = z.string().trim().optional().transform((v) => v && v.length > 0 ? v?.replace(/\/+$/, "") : void 0);
var schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Public URL of THIS backend as browsers reach it. With the Vercel
   *  proxy setup this is the VERCEL URL (vercel.json rewrites forward
   *  /api/* here). The Discord OAuth redirect is `${APP_URL}/api/auth/callback`.
   *  Trailing slashes are stripped. */
  APP_URL: z.preprocess(
    (v) => typeof v === "string" ? v.trim().replace(/\/+$/, "") : v,
    z.string().url()
  ).default("http://localhost:3001"),
  /** Bind address for the HTTP server (hosting platforms need 0.0.0.0). */
  HOST: z.string().default("0.0.0.0"),
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_CLIENT_SECRET: z.string().optional().default(""),
  SESSION_SECRET: z.string().optional().default(""),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/slux"),
  // ── Dashboard ────────────────────────────────────────────────────
  /** Master switch: set false to run the bot WITHOUT any dashboard —
   *  no API routes, no socket server, no dashboard links in embeds,
   *  and no OAuth secrets required. */
  DASHBOARD_ENABLED: boolFlag(true),
  /** Where the dashboard frontend is hosted (e.g. your Vercel URL).
   *  Used for bot embed links, the post-login redirect and CORS.
   *  Defaults to APP_URL when unset. */
  DASHBOARD_URL: optionalUrl,
  // ── Lavalink: main node (3rd-party) ──────────────────────────────
  LAVALINK_HOST: z.string().default("localhost"),
  LAVALINK_PORT: z.coerce.number().int().positive().default(2333),
  LAVALINK_PASS: z.string().default("youshallnotpass"),
  // TLS (wss/https) — most 3rd-party nodes need this
  LAVALINK_SECURE: boolFlag(false),
  LAVALINK_NAME: z.string().min(1).default("main"),
  // ── Lavalink: optional backup node ───────────────────────────────
  // Set LAVALINK_BACKUP_HOST to enable automatic failover: Shoukaku picks
  // the healthiest connected node (by penalties), so when the main node is
  // offline or busy the backup takes over automatically.
  LAVALINK_BACKUP_HOST: optionalHost,
  LAVALINK_BACKUP_PORT: z.coerce.number().int().positive().optional(),
  LAVALINK_BACKUP_PASS: z.string().optional(),
  LAVALINK_BACKUP_SECURE: boolFlag(false),
  LAVALINK_BACKUP_NAME: z.string().min(1).default("backup"),
  SPOTIFY_CLIENT_ID: z.string().optional().default(""),
  SPOTIFY_CLIENT_SECRET: z.string().optional().default("")
}).superRefine((env2, ctx) => {
  if (!env2.DASHBOARD_ENABLED) return;
  if (!env2.DISCORD_CLIENT_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ["DISCORD_CLIENT_SECRET"],
      message: "DISCORD_CLIENT_SECRET is required when the dashboard is enabled (or set DASHBOARD_ENABLED=false)"
    });
  }
  if (env2.SESSION_SECRET.length < 32) {
    ctx.addIssue({
      code: "custom",
      path: ["SESSION_SECRET"],
      message: "SESSION_SECRET must be at least 32 characters when the dashboard is enabled (or set DASHBOARD_ENABLED=false)"
    });
  }
});
function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(
      `[slux] Invalid environment configuration:
${issues}
Copy .env.example to .env and fill in the required values.`
    );
  }
  return parsed.data;
}
function getEnv() {
  if (!globalThis.__slux_env) globalThis.__slux_env = loadEnv();
  return globalThis.__slux_env;
}

// src/lib/lavalink.ts
function lavalinkNodeOptions() {
  const env2 = getEnv();
  const nodes = [
    {
      name: env2.LAVALINK_NAME,
      url: `${env2.LAVALINK_HOST}:${env2.LAVALINK_PORT}`,
      auth: env2.LAVALINK_PASS,
      secure: env2.LAVALINK_SECURE
    }
  ];
  if (env2.LAVALINK_BACKUP_HOST) {
    nodes.push({
      name: env2.LAVALINK_BACKUP_NAME,
      url: `${env2.LAVALINK_BACKUP_HOST}:${env2.LAVALINK_BACKUP_PORT ?? (env2.LAVALINK_BACKUP_SECURE ? 443 : 2333)}`,
      auth: env2.LAVALINK_BACKUP_PASS || env2.LAVALINK_PASS,
      secure: env2.LAVALINK_BACKUP_SECURE
    });
  }
  return nodes;
}

// src/bot/music/MusicManager.ts
var MusicManager = class _MusicManager {
  client;
  players = /* @__PURE__ */ new Map();
  events;
  constructor(client, events) {
    this.client = client;
    this.events = events;
  }
  get shoukaku() {
    return this.client.shoukaku;
  }
  idealNode() {
    return this.shoukaku?.getIdealNode();
  }
  // ── Voice / player lifecycle ─────────────────────────────────────
  getPlayer(guildId) {
    return this.players.get(guildId);
  }
  async createPlayer(member, channel, textChannel) {
    const guildId = member.guild.id;
    const voice = channel ?? member.voice.channel;
    if (!voice) return null;
    const existing = this.players.get(guildId);
    if (existing) {
      const connection = this.shoukaku?.connections.get(guildId);
      if (connection && connection.channelId !== voice.id) {
        await this.shoukaku?.joinVoiceChannel({
          guildId,
          shardId: 0,
          channelId: voice.id,
          deaf: true
        }).catch(() => {
        });
      }
      if (textChannel) existing.bindTextChannel(textChannel);
      return existing;
    }
    const shoukaku = this.shoukaku;
    if (!shoukaku) return null;
    if (shoukaku.connections.has(guildId)) {
      console.warn(`[slux] Cleaning stale voice connection in guild ${guildId}`);
      await shoukaku.leaveVoiceChannel(guildId).catch(() => {
      });
    }
    const player = await shoukaku.joinVoiceChannel({
      guildId,
      shardId: 0,
      channelId: voice.id,
      deaf: true
    });
    const guildPlayer = new GuildPlayer(guildId, this.client, player, {
      onSnapshot: (snapshot) => this.events.onSnapshot?.(snapshot),
      onTrackStart: (gid, track) => this.events.onTrackStart?.(gid, track),
      onDestroy: (gid, reason) => {
        this.players.delete(gid);
        void this.setVoiceChannelStatus(gid, null);
        this.events.onDestroy?.(gid, reason);
      }
    });
    if (textChannel) guildPlayer.bindTextChannel(textChannel);
    this.players.set(guildId, guildPlayer);
    return guildPlayer;
  }
  async destroyPlayer(guildId, reason = "stopped") {
    const player = this.players.get(guildId);
    if (!player) return;
    await this.setVoiceChannelStatus(guildId, null);
    await player.destroy(reason);
    this.players.delete(guildId);
    await this.shoukaku?.leaveVoiceChannel(guildId).catch(() => {
    });
  }
  // ── Voice channel status ─────────────────────────────────────────
  voiceStatusWarned = /* @__PURE__ */ new Set();
  /**
   * Set (or clear with null) the status text shown under the voice channel
   * name. Uses the dedicated `PUT /channels/{id}/voice-status` endpoint and
   * requires the "Set Voice Channel Status" permission.
   */
  async setVoiceChannelStatus(guildId, status) {
    const channelId = this.shoukaku?.connections.get(guildId)?.channelId;
    if (!channelId) return;
    const channel = this.client.channels.cache.get(channelId);
    const me = this.client.guilds.cache.get(guildId)?.members.me;
    if (channel && me && channel.isDMBased() === false) {
      const allowed = channel.permissionsFor(me)?.has(PermissionFlagsBits.SetVoiceChannelStatus);
      if (allowed === false) {
        if (!this.voiceStatusWarned.has(guildId)) {
          this.voiceStatusWarned.add(guildId);
          console.warn(
            `[slux] Missing "Set Voice Channel Status" permission in guild ${guildId} \u2014 channel status updates disabled. Grant it to the bot's role in Server Settings (or re-invite with the updated invite link).`
          );
        }
        return;
      }
    }
    try {
      await this.client.rest.put(Routes.channelVoiceStatus(channelId), {
        body: { status }
      });
      this.voiceStatusWarned.delete(guildId);
    } catch (err) {
      if (status === null) {
        const cleared = await this.client.rest.delete(Routes.channelVoiceStatus(channelId)).then(() => true).catch(() => false);
        if (cleared) return;
      }
      if (!this.voiceStatusWarned.has(guildId)) {
        this.voiceStatusWarned.add(guildId);
        console.warn(
          `[slux] Could not set voice channel status in guild ${guildId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }
  // ── Search / resolve ─────────────────────────────────────────────
  static extractTracks(response) {
    if (!response) return [];
    if (response.loadType === "track") return [response.data];
    if (response.loadType === "playlist") return response.data.tracks;
    if (response.loadType === "search") return response.data;
    return [];
  }
  static isUrl(query) {
    return /^https?:\/\//i.test(query.trim());
  }
  static hasSourcePrefix(query) {
    return /^[a-z]{2,10}(search|isrc|rec):/i.test(query.trim());
  }
  /** Unified LavaSearch endpoint (`/v4/loadsearch`) with a source prefix.
   *  `amsearch:` (Apple Music) works without credentials and returns the
   *  cleanest metadata; playback mirrors to YouTube via the providers chain.
   *  Returns [] when unavailable or empty. */
  async loadSearch(query, limit) {
    try {
      const data = await this.lavalinkFetch(
        `/v4/loadsearch?query=${encodeURIComponent(query)}&types=track`
      );
      return (data?.tracks ?? []).slice(0, limit);
    } catch {
      return [];
    }
  }
  async resolve(query, requester, forceSearch = false) {
    const node = this.idealNode();
    if (!node) return { kind: "error" };
    const trimmed = query.trim();
    const requesterInfo = { id: requester.id, tag: requester.tag, avatar: requester.avatar };
    if (!_MusicManager.isUrl(trimmed) && !_MusicManager.hasSourcePrefix(trimmed)) {
      const searchTracks = await this.loadSearch(`amsearch:${trimmed}`, 5);
      if (searchTracks.length > 0) {
        const tracks2 = searchTracks.map((t2) => trackFromShoukaku(t2, requesterInfo));
        if (forceSearch || tracks2.length > 1) return { kind: "search", tracks: tracks2 };
        return { kind: "track", track: tracks2[0] };
      }
      const scRes = await node.rest.resolve(`scsearch:${trimmed}`).catch(() => void 0);
      if (scRes?.loadType === "search" && scRes.data.length > 0) {
        const tracks2 = scRes.data.slice(0, 5).map((t2) => trackFromShoukaku(t2, requesterInfo));
        if (forceSearch || tracks2.length > 1) return { kind: "search", tracks: tracks2 };
        return { kind: "track", track: tracks2[0] };
      }
    }
    const identifier = _MusicManager.isUrl(trimmed) || _MusicManager.hasSourcePrefix(trimmed) ? trimmed : `ytsearch:${trimmed}`;
    let response;
    try {
      response = await node.rest.resolve(identifier);
    } catch {
      return { kind: "error" };
    }
    if (!response || response.loadType === "empty") return { kind: "empty" };
    if (response.loadType === "error") return { kind: "error" };
    if (response.loadType === "track") {
      return { kind: "track", track: trackFromShoukaku(response.data, requesterInfo) };
    }
    if (response.loadType === "playlist") {
      const tracks2 = response.data.tracks.slice(0, 1e3).map((t2) => trackFromShoukaku(t2, requesterInfo));
      if (tracks2.length === 0) return { kind: "empty" };
      if (tracks2.length === 1) return { kind: "track", track: tracks2[0] };
      return { kind: "playlist", tracks: tracks2, playlistName: response.data.info.name };
    }
    const tracks = response.data.slice(0, 5).map((t2) => trackFromShoukaku(t2, requesterInfo));
    if (tracks.length === 0) return { kind: "empty" };
    if (forceSearch || tracks.length > 1) {
      return { kind: "search", tracks };
    }
    return { kind: "track", track: tracks[0] };
  }
  /** Search-only helper used by the dashboard search box. */
  async search(query, limit = 10) {
    const node = this.idealNode();
    if (!node) return [];
    const trimmed = query.trim();
    let tracks = [];
    if (!_MusicManager.isUrl(trimmed) && !_MusicManager.hasSourcePrefix(trimmed)) {
      tracks = await this.loadSearch(`amsearch:${trimmed}`, limit);
      if (tracks.length === 0) {
        const scRes = await node.rest.resolve(`scsearch:${trimmed}`).catch(() => void 0);
        if (scRes?.loadType === "search") tracks = scRes.data.slice(0, limit);
      }
    }
    if (tracks.length === 0) {
      try {
        const identifier = _MusicManager.isUrl(trimmed) || _MusicManager.hasSourcePrefix(trimmed) ? trimmed : `ytsearch:${trimmed}`;
        tracks = _MusicManager.extractTracks(await node.rest.resolve(identifier)).slice(0, limit);
      } catch {
        return [];
      }
    }
    return tracks.map((t2) => ({
      encoded: t2.encoded,
      title: t2.info.title,
      author: t2.info.author,
      length: t2.info.length,
      uri: t2.info.uri ?? "",
      artwork: t2.info.artworkUrl ?? "",
      sourceName: t2.info.sourceName,
      identifier: t2.info.identifier,
      isStream: t2.info.isStream
    }));
  }
  /** Decode a base64 track into a playable ResolvedTrack. */
  async decode(encoded, requester) {
    const node = this.idealNode();
    if (!node) return null;
    try {
      const track = await node.rest.decode(encoded);
      if (!track) return null;
      return trackFromShoukaku(track, requester);
    } catch {
      return null;
    }
  }
  // ── Lyrics (LavaLyrics REST) ─────────────────────────────────────
  lyricsCache = /* @__PURE__ */ new Map();
  static LYRICS_TTL_MS = 10 * 60 * 1e3;
  static LYRICS_NEGATIVE_TTL_MS = 3 * 60 * 1e3;
  lyricsCacheKey(title, author) {
    return `${title.toLowerCase().trim()}::${author.toLowerCase().trim()}`;
  }
  lyricsCacheGet(key) {
    const entry = this.lyricsCache.get(key);
    if (!entry) return void 0;
    if (entry.expires < Date.now()) {
      this.lyricsCache.delete(key);
      return void 0;
    }
    return entry;
  }
  lyricsCacheSet(key, result) {
    this.lyricsCache.set(key, {
      result,
      expires: Date.now() + (result ? _MusicManager.LYRICS_TTL_MS : _MusicManager.LYRICS_NEGATIVE_TTL_MS)
    });
    if (this.lyricsCache.size > 200) {
      const oldest = this.lyricsCache.keys().next().value;
      if (oldest !== void 0) this.lyricsCache.delete(oldest);
    }
  }
  /** Cached lyrics lookup for a track: session endpoint first, then query fallback. */
  async lyricsForTrack(guildId, track) {
    const key = this.lyricsCacheKey(track.title, track.author);
    const cached = this.lyricsCacheGet(key);
    if (cached) return cached.result;
    let result = await this.lyrics(guildId, track).catch(() => null);
    if (!result) {
      result = await this.lyricsForQuery(`${track.title} ${track.author}`, track).catch(() => null);
    }
    this.lyricsCacheSet(key, result);
    return result;
  }
  async lyrics(guildId, track) {
    const node = this.idealNode();
    if (!node?.sessionId) return null;
    try {
      const res = await this.lavalinkFetch(
        `/v4/sessions/${node.sessionId}/players/${guildId}/track/lyrics`
      );
      return _MusicManager.parseLyrics(res, track ?? void 0);
    } catch {
      return null;
    }
  }
  async lyricsForQuery(query, track) {
    const outcome = await this.resolve(query, {
      id: "lyrics",
      tag: "Lyrics lookup",
      avatar: ""
    });
    const encoded = outcome.track?.encoded ?? outcome.tracks?.[0]?.encoded;
    if (!encoded) return null;
    try {
      const res = await this.lavalinkFetch(`/v4/lyrics?track=${encodeURIComponent(encoded)}`);
      return _MusicManager.parseLyrics(res, track ?? void 0);
    } catch {
      return null;
    }
  }
  /** Raw GET against a Lavalink node's REST API (lyrics, loadsearch).
   *  Uses whichever node is currently ideal, so requests keep working when
   *  the main node is offline and the backup has taken over. */
  async lavalinkFetch(path) {
    const node = this.idealNode();
    if (!node) throw new Error("no Lavalink node connected");
    const opts = lavalinkNodeOptions().find((n) => n.name === node.name);
    if (!opts) throw new Error(`unknown node "${node.name}"`);
    const base = `${opts.secure ? "https" : "http"}://${opts.url}`;
    const res = await fetch(base + path, {
      headers: { Authorization: opts.auth },
      signal: AbortSignal.timeout(1e4)
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`Lavalink REST ${res.status}`);
    return res.json();
  }
  static parseLyrics(data, meta) {
    if (!data || typeof data !== "object") return null;
    const obj = data;
    const lines = Array.isArray(obj.lines) ? obj.lines : [];
    const source = obj.sourceName || obj.provider || "";
    const text = typeof obj.text === "string" ? obj.text : void 0;
    const trackTitle = meta?.title ?? (obj.trackTitle || "");
    const artist = meta?.author ?? (obj.artist || "");
    if (lines.length > 0) {
      const parsed = lines.map((line) => ({
        timestamp: line.timestamp ?? 0,
        line: line.line ?? ""
      }));
      const synced = parsed.some((l) => l.timestamp > 0);
      return {
        trackTitle,
        artist,
        source,
        synced,
        lines: parsed
      };
    }
    if (text) {
      return { trackTitle, artist, source, synced: false, lines: [], text };
    }
    return null;
  }
  // ── Stats ────────────────────────────────────────────────────────
  stats() {
    const node = this.idealNode();
    return {
      players: this.players.size,
      playingPlayers: [...this.players.values()].filter((p) => p.current).length,
      nodeStats: node?.stats ?? null,
      nodePenalties: node?.penalties ?? null
    };
  }
};

// src/bot/lib/embeds.ts
import { EmbedBuilder } from "discord.js";
var BRAND_COLOR = 9133302;
var ERROR_COLOR = 15680580;
var SUCCESS_COLOR = 2278750;
var EMOJI = {
  previous: "\u23EE\uFE0F",
  play: "\u25B6\uFE0F",
  pause: "\u23F8\uFE0F",
  stop: "\u23F9\uFE0F",
  skip: "\u23ED\uFE0F",
  loop: "\u{1F501}",
  loopTrack: "\u{1F502}",
  loopOff: "\u27A1\uFE0F",
  shuffle: "\u{1F500}",
  volume: "\u{1F50A}",
  volumeDown: "\u{1F509}",
  volumeMute: "\u{1F507}",
  queue: "\u{1F4DC}",
  nowPlaying: "\u{1F3A7}",
  added: "\u2795",
  addedTop: "\u23EB",
  playlist: "\u{1F4C1}",
  lyrics: "\u{1F4DD}",
  music: "\u{1F3B5}",
  cd: "\u{1F4BF}",
  mic: "\u{1F3A4}",
  autoplay: "\u2728",
  clock: "\u23F1\uFE0F",
  star: "\u2B50",
  heart: "\u2764\uFE0F",
  filters: "\u{1F39B}\uFE0F",
  settings: "\u2699\uFE0F",
  globe: "\u{1F310}",
  info: "\u2139\uFE0F",
  ok: "\u2705",
  error: "\u274C",
  warn: "\u26A0\uFE0F",
  user: "\u{1F464}",
  dj: "\u{1F3A7}",
  infinity: "\u267E\uFE0F",
  rocket: "\u{1F680}",
  wave: "\u{1F30A}",
  link: "\u{1F517}",
  pin: "\u{1F4CD}",
  fire: "\u{1F525}",
  bookmark: "\u{1F516}",
  history: "\u{1F558}",
  gear: "\u2699\uFE0F",
  page: "\u{1F4C4}",
  speaker: "\u{1F4E2}"
};
var FILTER_EMOJI = {
  bassboost: "\u{1F50A}",
  nightcore: "\u{1F680}",
  vaporwave: "\u{1F334}",
  soft: "\u{1F54A}\uFE0F",
  "8d": "\u{1F300}",
  karaoke: "\u{1F3A4}",
  tremolo: "\u3030\uFE0F",
  vibrato: "\u{1F39A}\uFE0F",
  distortion: "\u{1F4A5}",
  lowpass: "\u{1F4C9}",
  speed: "\u23E9",
  pitch: "\u{1F3BC}",
  eq: "\u{1F39A}\uFE0F"
};
function filterEmoji(name) {
  return FILTER_EMOJI[name.toLowerCase()] ?? EMOJI.filters;
}
function baseEmbed(color = BRAND_COLOR) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}
function errorEmbed(t2, message, title) {
  const embed = new EmbedBuilder().setColor(ERROR_COLOR).setAuthor({ name: `${EMOJI.error} ${title ?? t2("common.errorTitle")}` });
  if (message) embed.setDescription(message);
  return embed;
}
function successEmbed(t2, message, title) {
  const embed = new EmbedBuilder().setColor(SUCCESS_COLOR).setAuthor({ name: `${EMOJI.ok} ${title ?? t2("common.doneTitle")}` });
  if (message) embed.setDescription(message);
  return embed;
}
function sourceEmoji(sourceName) {
  const s = (sourceName || "").toLowerCase();
  if (s.includes("spotify")) return "\u{1F7E2}";
  if (s.includes("youtube")) return "\u{1F534}";
  if (s.includes("soundcloud")) return "\u{1F7E0}";
  if (s.includes("deezer")) return "\u{1F7E3}";
  if (s.includes("applemusic")) return "\u{1F34E}";
  if (s.includes("tidal")) return "\u{1F30A}";
  if (s.includes("http") || s.includes("local")) return "\u{1F517}";
  return "\u{1F3B5}";
}
function sourceLabel(sourceName) {
  const s = (sourceName || "").toLowerCase();
  if (s.includes("spotify")) return "Spotify";
  if (s.includes("youtube")) return "YouTube";
  if (s.includes("soundcloud")) return "SoundCloud";
  if (s.includes("deezer")) return "Deezer";
  if (s.includes("applemusic")) return "Apple Music";
  if (s.includes("tidal")) return "Tidal";
  if (s.includes("http")) return "Direct link";
  return sourceName || "Unknown";
}
function progressBar(position, length, size = 14) {
  if (!Number.isFinite(length) || length <= 0) return "";
  const ratio = Math.min(1, Math.max(0, position / length));
  const filled = Math.round(ratio * (size - 1));
  const bar = "\u25AC".repeat(filled) + "\u{1F518}" + "\u25AC".repeat(Math.max(0, size - 1 - filled));
  return `\`${formatDuration(position)}\` ${bar} \`${formatDuration(length)}\``;
}
function volumeBar(level, size = 10) {
  const clamped = Math.min(150, Math.max(0, level));
  const filled = Math.round(clamped / 150 * size);
  return "\u25B0".repeat(filled) + "\u25B1".repeat(Math.max(0, size - filled));
}
function trackLine(track, index) {
  const duration = track.isStream ? "LIVE" : formatDuration(track.length);
  const prefix = index !== void 0 ? `\`${index}.\`` : "\u25B8";
  const title = track.uri ? `[${track.title}](${track.uri})` : track.title;
  return `${prefix} ${title} \u2014 **${track.author}** \`[${duration}]\``;
}
function trackAddedEmbed(t2, track, extras) {
  const embed = baseEmbed().setAuthor({
    name: `${extras.top ? EMOJI.addedTop : EMOJI.added} ${t2(extras.top ? "music.addedTopTitle" : "music.addedTitle")}`
  }).setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title).setURL(track.uri || null).setDescription(`**${track.author}**`);
  if (track.artwork) embed.setThumbnail(track.artwork);
  embed.addFields(
    {
      name: `${EMOJI.clock} ${t2("music.npLength")}`,
      value: track.isStream ? `\u{1F534} ${t2("music.live")}` : `\`${formatDuration(track.length)}\``,
      inline: true
    },
    {
      name: `${EMOJI.queue} ${t2("music.queuePosition")}`,
      value: `\`#${extras.position ?? extras.queueLength}\``,
      inline: true
    },
    {
      name: `${EMOJI.cd} ${t2("music.queueTotal")}`,
      value: `\`${extras.queueLength}\` ${t2("common.tracks")}`,
      inline: true
    }
  );
  embed.setFooter({
    text: `${t2("common.requestedBy", { user: track.requesterTag })} \u2022 ${sourceEmoji(track.sourceName)} ${sourceLabel(track.sourceName)}`,
    iconURL: track.requesterAvatar || void 0
  });
  return embed;
}
function nowPlayingEmbed(t2, track, extras) {
  const statusEmoji = extras.paused ? EMOJI.pause : EMOJI.nowPlaying;
  const statusText = extras.paused ? t2("music.pausedLabel") : t2("music.nowPlaying");
  const embed = baseEmbed().setAuthor({ name: `${statusEmoji} ${statusText}`, iconURL: track.requesterAvatar || void 0 }).setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title).setURL(track.uri || null).setDescription(`**${track.author}**`).setFooter({
    text: `${t2("common.requestedBy", { user: track.requesterTag })} \u2022 ${sourceEmoji(track.sourceName)} ${sourceLabel(track.sourceName)}`,
    iconURL: track.requesterAvatar || void 0
  });
  if (track.artwork) embed.setThumbnail(track.artwork);
  const fields = [];
  if (!track.isStream) {
    fields.push({
      name: `${EMOJI.clock} ${t2("music.npProgress")}`,
      value: progressBar(extras.position, track.length) || "\u2014",
      inline: false
    });
  } else {
    fields.push({ name: EMOJI.fire, value: `\u{1F534} ${t2("music.live")} \u2014 ${t2("music.stream")}`, inline: false });
  }
  fields.push({ name: `${EMOJI.volume} ${t2("music.npVolume")}`, value: `\`${extras.volume}%\``, inline: true });
  fields.push({
    name: `${loopEmoji(extras.repeat)} ${t2("music.npLoop")}`,
    value: `\`${loopLabel(t2, extras.repeat)}\``,
    inline: true
  });
  fields.push({
    name: `${EMOJI.filters} ${t2("music.npFilters")}`,
    value: extras.filters.length > 0 ? extras.filters.map((f) => filterEmoji(f)).join(" ") : t2("common.none"),
    inline: true
  });
  return embed.addFields(fields);
}
function loopEmoji(repeat) {
  return repeat === "track" ? EMOJI.loopTrack : repeat === "queue" ? EMOJI.loop : EMOJI.loopOff;
}
function loopLabel(t2, repeat) {
  return repeat === "track" ? t2("music.loopModeTrack") : repeat === "queue" ? t2("music.loopModeQueue") : t2("music.loopModeOff");
}
function statusEmbed(t2, player, opts) {
  const embed = baseEmbed().setAuthor({ name: `${opts.emoji} ${opts.title}` });
  if (opts.description) embed.setDescription(opts.description);
  const track = player.current;
  if (track) {
    const lines = [
      `${EMOJI.music} **[${track.title}](${track.uri || "https://discord.com"})**`,
      `\u{1F464} **${track.author}**`
    ];
    if (!track.isStream) {
      lines.push(progressBar(player.player.position, track.length) || "");
    }
    embed.addFields({ name: EMOJI.nowPlaying, value: lines.filter(Boolean).join("\n"), inline: false });
    if (track.artwork) embed.setThumbnail(track.artwork);
    embed.setFooter({
      text: `${EMOJI.volume} ${player.volume}% \u2022 ${loopEmoji(player.repeat)} ${loopLabel(t2, player.repeat)} \u2022 ${sourceEmoji(track.sourceName)} ${sourceLabel(track.sourceName)}`
    });
  }
  return embed;
}
function localeChoices() {
  return [
    { name: "\u{1F1EC}\u{1F1E7} English", value: "en" },
    { name: "\u{1F1EE}\u{1F1F3} \u0939\u093F\u0928\u094D\u0926\u0940", value: "hi" },
    { name: "\u{1F1EA}\u{1F1F8} Espa\xF1ol", value: "es" },
    { name: "\u{1F1EB}\u{1F1F7} Fran\xE7ais", value: "fr" },
    { name: "\u{1F1E9}\u{1F1EA} Deutsch", value: "de" },
    { name: "\u{1F1E7}\u{1F1F7} Portugu\xEAs", value: "pt" }
  ];
}
function dashboardBase() {
  const env2 = getEnv();
  if (!env2.DASHBOARD_ENABLED) return null;
  return env2.DASHBOARD_URL ?? env2.APP_URL;
}
function localeLabel(locale) {
  return localeChoices().find((c) => c.value === locale)?.name ?? locale;
}

// src/bot/controller.ts
import {
  ActionRowBuilder as ActionRowBuilder2,
  ButtonBuilder as ButtonBuilder2,
  ButtonStyle as ButtonStyle2,
  MessageFlags,
  StringSelectMenuBuilder as StringSelectMenuBuilder2
} from "discord.js";

// src/bot/lib/permissions.ts
import { PermissionFlagsBits as PermissionFlagsBits2 } from "discord.js";
function isDJ(member, settings, player) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits2.ManageGuild)) return true;
  if (member.permissions.has(PermissionFlagsBits2.ManageChannels)) return true;
  if (settings.djRoles.length > 0 && member.roles.cache.some((r) => settings.djRoles.includes(r.id))) {
    return true;
  }
  if (player) {
    const channel = player.voiceChannel;
    if (channel) {
      const humans = channel.members.filter((m) => !m.user.bot);
      if (humans.size <= 1) return true;
    }
  }
  return false;
}
function isAloneListener(member, player) {
  if (!member) return false;
  const channel = player.voiceChannel;
  if (!channel) return false;
  const humans = channel.members.filter((m) => !m.user.bot);
  return humans.has(member.id);
}
function canControl(member, settings, player) {
  if (player.djMode && !isAloneListener(member, player) && !isDJ(member, settings, player)) {
    return false;
  }
  return true;
}
function botChannelAllowed(guild, settings, channelId) {
  if (settings.botChannels.length === 0) return true;
  return settings.botChannels.includes(channelId);
}
function manageGuild(member) {
  return !!member?.permissions.has(PermissionFlagsBits2.ManageGuild);
}

// src/bot/lib/queueview.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from "discord.js";
var PER_PAGE = 10;
async function buildQueueMessage(player, guildName, page, t2, iconUrl) {
  if (!player || !player.current) {
    return { embed: errorEmbed(t2, t2("common.noPlayer")), components: [] };
  }
  const totalPages = Math.max(1, Math.ceil(player.queue.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const items = player.queue.slice(start, start + PER_PAGE);
  const current = player.current;
  const nowPlaying = `${EMOJI.nowPlaying} **[${current.title}](${current.uri || "https://discord.com"})**
\u{1F464} **${current.author}** ${sourceEmoji(current.sourceName)}
` + (current.isStream ? `\u{1F534} ${t2("music.live")}` : progressBar(player.player.position, current.length) || "");
  const embed = baseEmbed(6514417).setAuthor({ name: `${EMOJI.queue} ${t2("music.queueTitle", { guild: guildName })}`, iconURL: iconUrl }).setDescription(nowPlaying).setFooter({
    text: `${t2("common.page", { current: safePage, total: totalPages })} \u2022 ${t2("music.queueFooter", {
      count: player.queue.length,
      duration: formatDuration(player.queue.reduce((a, tr) => a + tr.length, 0))
    })} \u2022 ${loopEmoji(player.repeat)} ${loopLabel(t2, player.repeat)}`
  });
  if (current.artwork) embed.setThumbnail(current.artwork);
  if (items.length === 0) {
    embed.addFields({
      name: `${EMOJI.cd} ${t2("music.queueUpNext")}`,
      value: `*${t2("common.queueEmpty")}*`,
      inline: false
    });
  } else {
    embed.addFields({
      name: `${EMOJI.cd} ${t2("music.queueUpNext")}`,
      value: items.map((tr, i) => trackLine(tr, start + i + 1)).join("\n").slice(0, 1024),
      inline: false
    });
  }
  const components = [];
  if (totalPages > 1) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`slux:q:1`).setEmoji("\u23EA").setLabel("1").setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 1)
    ).addComponents(
      new ButtonBuilder().setCustomId(`slux:q:${safePage - 1}`).setEmoji("\u25C0").setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 1)
    ).addComponents(
      new ButtonBuilder().setCustomId(`slux:q:${safePage}`).setLabel(`${safePage} / ${totalPages}`).setEmoji("\u{1F504}").setStyle(ButtonStyle.Primary).setDisabled(false)
    ).addComponents(
      new ButtonBuilder().setCustomId(`slux:q:${safePage + 1}`).setEmoji("\u25B6").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages)
    ).addComponents(
      new ButtonBuilder().setCustomId(`slux:q:${totalPages}`).setEmoji("\u23E9").setLabel(String(totalPages)).setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages)
    );
    components.push(row);
    if (totalPages > 2) {
      const menu = new StringSelectMenuBuilder().setCustomId("slux:qsel").setPlaceholder(t2("music.queueJumpTo")).setMinValues(1).setMaxValues(1).addOptions(
        Array.from({ length: Math.min(25, totalPages) }, (_, i) => ({
          label: t2("music.queuePageOption", { page: i + 1 }),
          value: String(i + 1)
        }))
      );
      components.push(new ActionRowBuilder().addComponents(menu));
    }
  }
  return { embed, components };
}

// src/bot/lib/lyricsview.ts
function buildLyricsPages(lyrics2) {
  const chunks = [];
  if (lyrics2.synced && lyrics2.lines.length > 0) {
    for (const line of lyrics2.lines) {
      const stamp = formatDuration(line.timestamp);
      chunks.push(`\`${stamp}\` ${line.line}`);
    }
  } else if (lyrics2.text) {
    chunks.push(...lyrics2.text.split("\n"));
  }
  const pages = [];
  let current = "";
  for (const line of chunks) {
    if (current.length + line.length > 1900) {
      pages.push(current);
      current = "";
    }
    current += `${line}
`;
  }
  if (current.trim()) pages.push(current);
  return pages.length > 0 ? pages : ["\u2014"];
}
function lyricsEmbed(t2, track, lyrics2, pageContent, page, totalPages) {
  const embed = baseEmbed().setAuthor({ name: `${EMOJI.lyrics} ${t2("music.lyricsTitle")}` }).setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title).setURL(track.uri || null).setDescription(pageContent.slice(0, 3900)).setFooter({
    text: `${t2("common.page", { current: page, total: totalPages })} \u2022 ${lyrics2.synced ? `\u{1F399}\uFE0F ${t2("music.lyricsSynced")}` : `\u{1F4C4} ${t2("music.lyricsPlain")}`} \u2022 ${lyrics2.source || "lyrics"}`
  });
  if (track.artwork) embed.setThumbnail(track.artwork);
  return embed;
}
async function sendLyricsPaged(opts) {
  const { music: music6, pagination, player, t: t2, track } = opts;
  const lyrics2 = await music6.lyricsForTrack(player.guildId, track);
  if (!lyrics2 || !lyrics2.lines?.length && !lyrics2.text) {
    await opts.send({
      embeds: [errorEmbed(t2, t2("music.lyricsNone"), t2("music.lyricsTitle"))],
      components: []
    });
    return;
  }
  const pages = buildLyricsPages(lyrics2);
  if (!pagination) {
    await opts.send({ embeds: [lyricsEmbed(t2, track, lyrics2, pages[0] ?? "", 1, pages.length)] });
    return;
  }
  const id = pagination.create(pages.length, (page) => ({
    embeds: [lyricsEmbed(t2, track, lyrics2, pages[page - 1] ?? "", page, pages.length)]
  }));
  const view = pagination.build(id, 1);
  const message = await opts.send(view);
  pagination.attach(id, message);
}

// src/bot/controller.ts
async function translatorForGuild(guildId) {
  try {
    const settings = await getGuildSettings(guildId);
    return createTranslator(normalizeLocale(settings.language));
  } catch {
    return createTranslator("en");
  }
}
function buildControllerComponents(player, t2) {
  const row1 = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId("slux:ctrl:previous").setEmoji(EMOJI.previous).setLabel(t2("music.ctrlPrevious")).setStyle(ButtonStyle2.Secondary)
  ).addComponents(
    new ButtonBuilder2().setCustomId(player.paused ? "slux:ctrl:resume" : "slux:ctrl:pause").setEmoji(player.paused ? EMOJI.play : EMOJI.pause).setLabel(player.paused ? t2("music.ctrlResume") : t2("music.ctrlPause")).setStyle(ButtonStyle2.Primary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:ctrl:skip").setEmoji(EMOJI.skip).setLabel(t2("music.ctrlSkip")).setStyle(ButtonStyle2.Secondary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:ctrl:loop").setEmoji(loopEmoji(player.repeat)).setLabel(t2("music.ctrlLoop")).setStyle(player.repeat === "off" ? ButtonStyle2.Secondary : ButtonStyle2.Success)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:ctrl:stop").setEmoji(EMOJI.stop).setLabel(t2("music.ctrlStop")).setStyle(ButtonStyle2.Danger)
  );
  const row2 = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId("slux:ctrl:shuffle").setEmoji(EMOJI.shuffle).setLabel(t2("music.ctrlShuffle")).setStyle(player.shuffle ? ButtonStyle2.Success : ButtonStyle2.Secondary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:ctrl:queue").setEmoji(EMOJI.queue).setLabel(t2("music.ctrlQueue")).setStyle(ButtonStyle2.Primary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:ctrl:lyrics").setEmoji(EMOJI.lyrics).setLabel(t2("music.ctrlLyrics")).setStyle(ButtonStyle2.Secondary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:ctrl:voldown").setEmoji(EMOJI.volumeDown).setLabel(t2("music.ctrlVolDown")).setStyle(ButtonStyle2.Secondary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:ctrl:volup").setEmoji(EMOJI.volume).setLabel(t2("music.ctrlVolUp")).setStyle(ButtonStyle2.Secondary)
  );
  return [row1, row2];
}
function controllerEmbedFor(player, t2) {
  if (!player.current) {
    return baseEmbed().setAuthor({ name: `${EMOJI.queue} ${t2("music.queueEnded")}` });
  }
  return nowPlayingEmbed(t2, player.current, {
    position: player.player.position,
    volume: player.volume,
    repeat: player.repeat,
    filters: player.snapshot().filters,
    paused: player.paused
  });
}
function controllerPayload(player, t2) {
  return { embeds: [controllerEmbedFor(player, t2)], components: buildControllerComponents(player, t2) };
}
async function handleControllerButton(interaction, bot, player, t2, settings, isDJFn = isDJ, canControlFn = canControl) {
  const action = interaction.customId.split(":")[2];
  const member = interaction.guild?.members.cache.get(interaction.user.id) ?? null;
  if (!canControlFn(member, settings, player)) {
    await interaction.reply({ embeds: [errorEmbed(t2, t2("music.djmodeActive"))], flags: MessageFlags.Ephemeral }).catch(() => {
    });
    return;
  }
  const channel = player.voiceChannel;
  if (channel && !channel.members.has(interaction.user.id) && !isDJFn(member, settings, player)) {
    await interaction.reply({ embeds: [errorEmbed(t2, t2("common.notInSameVoice"))], flags: MessageFlags.Ephemeral }).catch(() => {
    });
    return;
  }
  switch (action) {
    case "pause":
      await player.pause();
      break;
    case "resume":
      await player.resume();
      break;
    case "skip":
      await player.skip();
      break;
    case "previous":
      await player.previous();
      break;
    case "loop":
      player.cycleRepeat();
      break;
    case "shuffle":
      player.toggleShuffle();
      break;
    case "voldown":
      await player.setVolume(player.volume - 10);
      break;
    case "volup":
      await player.setVolume(player.volume + 10);
      break;
    case "queue": {
      const { embed, components } = await buildQueueMessage(
        player,
        interaction.guild?.name ?? "",
        1,
        t2,
        interaction.guild?.iconURL() ?? void 0
      );
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral }).catch(() => {
      });
      return;
    }
    case "lyrics": {
      const track = player.current;
      if (!track) {
        await interaction.reply({ embeds: [errorEmbed(t2, t2("common.noPlayer"))], flags: MessageFlags.Ephemeral }).catch(() => {
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {
      });
      await sendLyricsPaged({
        music: bot.music,
        pagination: bot.pagination,
        player,
        t: t2,
        track,
        send: async (payload) => {
          await interaction.editReply(payload).catch(() => {
          });
          return null;
        }
      });
      return;
    }
    case "stop": {
      await bot.music.destroyPlayer(player.guildId, "stopped");
      await interaction.update({
        embeds: [
          baseEmbed().setAuthor({ name: `${EMOJI.stop} ${t2("music.stoppedTitle")}` }).setDescription(t2("music.stopped"))
        ],
        components: []
      }).catch(() => {
      });
      return;
    }
  }
  await interaction.update(controllerPayload(player, t2)).catch(() => {
  });
}
var NowPlayingManager = class {
  messages = /* @__PURE__ */ new Map();
  states = /* @__PURE__ */ new Map();
  tickers = /* @__PURE__ */ new Map();
  stateOf(player) {
    return { paused: player.paused, repeat: player.repeat, shuffle: player.shuffle };
  }
  async handleTrackStart(bot, guildId) {
    const player = bot.music.getPlayer(guildId);
    if (!player?.current) return;
    const channel = player.textChannel;
    if (!channel || !("send" in channel) || typeof channel.send !== "function") return;
    await this.disableMessage(guildId);
    try {
      const t2 = await translatorForGuild(guildId);
      const message = await channel.send(controllerPayload(player, t2));
      this.messages.set(guildId, message);
      this.states.set(guildId, this.stateOf(player));
      this.startTicker(bot, guildId, message);
    } catch {
    }
  }
  /** Live progress: edit the now-playing embed every 5s so the playback bar
   *  stays in sync with the dashboard without any button presses. */
  startTicker(bot, guildId, message) {
    this.stopTicker(guildId);
    const timer = setInterval(() => {
      void (async () => {
        const player = bot.music.getPlayer(guildId);
        if (!player?.current) {
          this.stopTicker(guildId);
          return;
        }
        if (player.paused) return;
        try {
          const t2 = await translatorForGuild(guildId);
          await message.edit({ embeds: [controllerEmbedFor(player, t2)] });
        } catch {
          this.stopTicker(guildId);
        }
      })();
    }, 5e3);
    timer.unref?.();
    this.tickers.set(guildId, timer);
  }
  stopTicker(guildId) {
    const timer = this.tickers.get(guildId);
    if (timer) {
      clearInterval(timer);
      this.tickers.delete(guildId);
    }
  }
  /** Cheap sync — refreshes the controller buttons when pause/loop/shuffle changes. */
  handleSnapshot(bot, snapshot) {
    const message = this.messages.get(snapshot.guildId);
    if (!message) return;
    const state = { paused: snapshot.paused, repeat: snapshot.repeat, shuffle: snapshot.shuffle };
    const prev = this.states.get(snapshot.guildId);
    if (prev && prev.paused === state.paused && prev.repeat === state.repeat && prev.shuffle === state.shuffle) {
      return;
    }
    this.states.set(snapshot.guildId, state);
    if (!snapshot.track) {
      void this.disableMessage(snapshot.guildId);
      return;
    }
    const player = bot.music.getPlayer(snapshot.guildId);
    if (!player) return;
    void (async () => {
      const t2 = await translatorForGuild(snapshot.guildId);
      await message.edit({ components: buildControllerComponents(player, t2) }).catch(() => {
      });
    })();
  }
  async handlePlayerDestroy(guildId) {
    await this.disableMessage(guildId);
  }
  async disableMessage(guildId) {
    this.stopTicker(guildId);
    const message = this.messages.get(guildId);
    this.messages.delete(guildId);
    this.states.delete(guildId);
    if (!message) return;
    await message.edit({ components: disableAllRows(message) }).catch(() => {
    });
  }
};
function rowComponentsOf(row) {
  if (!row || typeof row !== "object") return [];
  return row.components ?? [];
}
function componentCustomId(component) {
  if (!component || typeof component !== "object") return void 0;
  const obj = component;
  return obj.customId ?? obj.custom_id;
}
function disableAllRows(message) {
  return message.components.map((row) => {
    const builder = new ActionRowBuilder2();
    for (const component of rowComponentsOf(row)) {
      builder.addComponents(
        ButtonBuilder2.from(component).setDisabled(true)
      );
    }
    return builder;
  });
}
function disableRowsWhere(message, predicate) {
  return message.components.map((row) => {
    const comps = rowComponentsOf(row);
    const matches = comps.some((c) => {
      const id = componentCustomId(c);
      return id !== void 0 && predicate(id);
    });
    if (!matches) return row;
    const builder = new ActionRowBuilder2();
    for (const component of comps) {
      builder.addComponents(ButtonBuilder2.from(component).setDisabled(true));
    }
    return builder;
  });
}
function buildPaginationRow(sessionId, page, totalPages) {
  const row = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId(`slux:pg:${sessionId}:f`).setEmoji("\u23EA").setLabel("1").setStyle(ButtonStyle2.Secondary).setDisabled(page <= 1)
  ).addComponents(
    new ButtonBuilder2().setCustomId(`slux:pg:${sessionId}:${page - 1}`).setEmoji("\u25C0").setStyle(ButtonStyle2.Secondary).setDisabled(page <= 1)
  ).addComponents(
    new ButtonBuilder2().setCustomId(`slux:pg:${sessionId}:x`).setLabel(`${page} / ${totalPages}`).setStyle(ButtonStyle2.Secondary).setDisabled(true)
  ).addComponents(
    new ButtonBuilder2().setCustomId(`slux:pg:${sessionId}:${page + 1}`).setEmoji("\u25B6").setStyle(ButtonStyle2.Secondary).setDisabled(page >= totalPages)
  ).addComponents(
    new ButtonBuilder2().setCustomId(`slux:pg:${sessionId}:l`).setEmoji("\u23E9").setLabel(String(totalPages)).setStyle(ButtonStyle2.Secondary).setDisabled(page >= totalPages)
  );
  return row;
}
var PaginationManager = class {
  sessions = /* @__PURE__ */ new Map();
  seq = 0;
  create(totalPages, render, ttlMs = 3e5) {
    const id = `${Date.now().toString(36)}${(this.seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const session = {
      totalPages: Math.max(1, totalPages),
      render,
      timeout: null
    };
    session.timeout = setTimeout(() => {
      this.sessions.delete(id);
      void session.message?.edit({ components: [] }).catch(() => {
      });
    }, ttlMs);
    session.timeout.unref?.();
    this.sessions.set(id, session);
    if (this.sessions.size > 100) {
      const oldest = this.sessions.keys().next().value;
      if (oldest) {
        clearTimeout(this.sessions.get(oldest)?.timeout);
        this.sessions.delete(oldest);
      }
    }
    return id;
  }
  attach(id, message) {
    const session = this.sessions.get(id);
    if (session) session.message = message;
  }
  /** Builds the message payload for a page: render rows + pagination row. */
  build(id, page = 1) {
    const session = this.sessions.get(id);
    if (!session) return { embeds: [], components: [] };
    const safePage = Math.min(Math.max(1, page), session.totalPages);
    const view = session.render(safePage);
    const rows = [...view.rows ?? []];
    if (session.totalPages > 1) rows.push(buildPaginationRow(id, safePage, session.totalPages));
    return { embeds: view.embeds, components: rows };
  }
  async handle(interaction, id, token, t2) {
    const session = this.sessions.get(id);
    if (!session) {
      const disabled = disableRowsWhere(interaction.message, (customId) => customId.startsWith("slux:pg:"));
      await interaction.reply({
        embeds: [errorEmbed(t2, t2("common.viewExpired"))],
        flags: MessageFlags.Ephemeral
      }).catch(() => {
      });
      await interaction.update({ components: disabled }).catch(() => {
      });
      return;
    }
    let page;
    if (token === "f") page = 1;
    else if (token === "l") page = session.totalPages;
    else page = parseInt(token, 10) || 1;
    page = Math.min(Math.max(1, page), session.totalPages);
    const view = session.render(page);
    const rows = [...view.rows ?? []];
    if (session.totalPages > 1) rows.push(buildPaginationRow(id, page, session.totalPages));
    await interaction.update({ embeds: view.embeds, components: rows }).catch(() => {
    });
  }
};
function buildSearchSelectComponents(t2, sessionId, tracks) {
  const menu = new StringSelectMenuBuilder2().setCustomId(`slux:sel:${sessionId}`).setPlaceholder(t2("music.selectPlaceholder")).setMinValues(1).setMaxValues(1).addOptions(
    tracks.slice(0, 25).map((track, i) => ({
      label: track.title.length > 100 ? `${track.title.slice(0, 97)}...` : track.title,
      description: `${track.author} \u2022 ${track.isStream ? "LIVE" : formatDuration(track.length)}`.slice(0, 100),
      value: String(i),
      emoji: sourceEmoji(track.sourceName)
    }))
  );
  const row1 = new ActionRowBuilder2().addComponents(menu);
  const row2 = new ActionRowBuilder2();
  for (let i = 0; i < Math.min(4, tracks.length); i++) {
    row2.addComponents(
      new ButtonBuilder2().setCustomId(`slux:sel:${sessionId}:${i}`).setLabel(String(i + 1)).setStyle(ButtonStyle2.Primary)
    );
  }
  row2.addComponents(
    new ButtonBuilder2().setCustomId(`slux:sel:${sessionId}:cancel`).setLabel(t2("music.cancelButton")).setEmoji("\u2716\uFE0F").setStyle(ButtonStyle2.Danger)
  );
  return [row1, row2];
}
async function handleSearchSelect(interaction, bot, player, t2, settings, rest, value) {
  const indexRaw = value ?? rest[1];
  if (indexRaw === "cancel") {
    await interaction.update({
      embeds: [
        baseEmbed().setAuthor({ name: `${EMOJI.error} ${t2("common.cancelled")}` })
      ],
      components: []
    }).catch(() => {
    });
    return;
  }
  const member = interaction.guild?.members.cache.get(interaction.user.id) ?? null;
  if (!canControl(member, settings, player)) {
    await interaction.reply({ embeds: [errorEmbed(t2, t2("music.djmodeActive"))], flags: MessageFlags.Ephemeral }).catch(() => {
    });
    return;
  }
  const searchStore = bot.searchSessions;
  const session = searchStore.get(interaction.message.id);
  if (!session) {
    await interaction.update({
      embeds: [errorEmbed(t2, t2("common.timeUp"))],
      components: []
    }).catch(() => {
    });
    return;
  }
  const index = parseInt(indexRaw ?? "0", 10);
  const track = session.tracks[index];
  if (!track) return;
  searchStore.delete(interaction.message.id);
  clearTimeout(session.timeout);
  const wasEmpty = !player.current;
  player.enqueue(track, wasEmpty ? void 0 : player.queue.length);
  if (wasEmpty) await player.startIfIdle();
  await interaction.update({
    embeds: [
      trackAddedEmbed(t2, track, {
        position: wasEmpty ? 1 : player.queue.length,
        queueLength: player.queue.length
      })
    ],
    components: []
  }).catch(() => {
  });
}
function loopRow(t2, player) {
  const row = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId("slux:loop:off").setLabel(t2("music.loopModeOff")).setEmoji(EMOJI.loopOff).setStyle(player.repeat === "off" ? ButtonStyle2.Success : ButtonStyle2.Secondary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:loop:track").setLabel(t2("music.loopModeTrack")).setEmoji(EMOJI.loopTrack).setStyle(player.repeat === "track" ? ButtonStyle2.Success : ButtonStyle2.Secondary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:loop:queue").setLabel(t2("music.loopModeQueue")).setEmoji(EMOJI.loop).setStyle(player.repeat === "queue" ? ButtonStyle2.Success : ButtonStyle2.Secondary)
  );
  return [row];
}
function loopStatusEmbed(t2, player) {
  const embed = baseEmbed().setAuthor({ name: `${loopEmoji(player.repeat)} ${t2("music.loopTitle")}` }).setDescription(t2("music.loopCurrent", { mode: `**${loopLabel(t2, player.repeat)}**` }));
  const track = player.current;
  if (track) {
    embed.addFields({
      name: EMOJI.nowPlaying,
      value: `${EMOJI.music} [${track.title}](${track.uri || "https://discord.com"}) \u2014 **${track.author}**`,
      inline: false
    });
    if (track.artwork) embed.setThumbnail(track.artwork);
  }
  return embed;
}
async function handleLoopButton(interaction, player, t2, modeRaw) {
  if (modeRaw === "off" || modeRaw === "track" || modeRaw === "queue") {
    await player.setRepeat(modeRaw);
  }
  await interaction.update({ embeds: [loopStatusEmbed(t2, player)], components: loopRow(t2, player) }).catch(() => {
  });
}
function volumeRow(t2, player) {
  const row = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId("slux:vol:-10").setLabel(t2("music.volDown")).setEmoji(EMOJI.volumeDown).setStyle(ButtonStyle2.Secondary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:vol:mute").setLabel(t2("music.volMute")).setEmoji(EMOJI.volumeMute).setStyle(player.volume === 0 ? ButtonStyle2.Danger : ButtonStyle2.Secondary)
  ).addComponents(
    new ButtonBuilder2().setCustomId("slux:vol:10").setLabel(t2("music.volUp")).setEmoji(EMOJI.volume).setStyle(ButtonStyle2.Secondary)
  );
  return [row];
}
function volumeStatusEmbed(t2, player) {
  const icon = player.volume === 0 ? EMOJI.volumeMute : player.volume < 50 ? EMOJI.volumeDown : EMOJI.volume;
  return baseEmbed().setAuthor({ name: `${icon} ${t2("music.volumeTitle")}` }).setDescription(`**${player.volume}%**
\`${volumeBar(player.volume)}\``);
}
async function handleVolumeButton(interaction, player, t2, token) {
  if (token === "mute") {
    await player.setVolume(player.volume === 0 ? 100 : 0);
  } else {
    const delta = parseInt(token, 10) || 0;
    await player.setVolume(player.volume + delta);
  }
  await interaction.update({ embeds: [volumeStatusEmbed(t2, player)], components: volumeRow(t2, player) }).catch(() => {
  });
}
function toggleRow(t2, key, state) {
  const labels = {
    autoplay: t2("music.autoplayLabel"),
    "247": "24/7",
    djmode: t2("music.djmodeLabel")
  };
  const emojis = {
    autoplay: EMOJI.autoplay,
    "247": EMOJI.infinity,
    djmode: EMOJI.dj
  };
  return [
    new ActionRowBuilder2().addComponents(
      new ButtonBuilder2().setCustomId(`slux:tgl:${key}`).setLabel(`${labels[key]}: ${state ? t2("common.on") : t2("common.off")}`).setEmoji(emojis[key]).setStyle(state ? ButtonStyle2.Success : ButtonStyle2.Secondary)
    )
  ];
}
function toggleStatusEmbed(t2, key, state) {
  const meta = {
    autoplay: {
      emoji: EMOJI.autoplay,
      title: t2("music.autoplayLabel"),
      on: t2("music.autoplayOn"),
      off: t2("music.autoplayOff")
    },
    "247": {
      emoji: EMOJI.infinity,
      title: "24/7",
      on: t2("music.stayOn"),
      off: t2("music.stayOff")
    },
    djmode: {
      emoji: EMOJI.dj,
      title: t2("music.djmodeLabel"),
      on: t2("music.djmodeOn"),
      off: t2("music.djmodeOff")
    }
  };
  const m = meta[key];
  return baseEmbed(state ? 2278750 : 9133302).setAuthor({ name: `${m.emoji} ${m.title}` }).setDescription(
    `${state ? EMOJI.ok : EMOJI.error} **${state ? t2("common.enabled") : t2("common.disabled")}**

${state ? m.on : m.off}`
  );
}
async function handleToggleButton(interaction, player, t2, keyRaw) {
  const key = ["autoplay", "247", "djmode"].includes(keyRaw) ? keyRaw : null;
  if (!key) return;
  if (key === "autoplay") player.autoplay = !player.autoplay;
  if (key === "247") player.stayInChannel = !player.stayInChannel;
  if (key === "djmode") player.djMode = !player.djMode;
  player.emit();
  await interaction.update({ embeds: [toggleStatusEmbed(t2, key, getPlayerToggle(player, key))], components: toggleRow(t2, key, getPlayerToggle(player, key)) }).catch(() => {
  });
}
function getPlayerToggle(player, key) {
  if (key === "autoplay") return player.autoplay;
  if (key === "247") return player.stayInChannel;
  return player.djMode;
}

// src/bot/commands/helpers.ts
async function getOrCreatePlayer(ctx) {
  if (!ctx.guild || !ctx.member) return null;
  const music6 = ctx.client.music;
  const existing = music6.getPlayer(ctx.guild.id);
  const player = await music6.createPlayer(ctx.member, null, ctx.channel);
  if (!player) return null;
  if (!existing) {
    const settings = await getGuildSettings(ctx.guild.id);
    await player.setVolume(settings.defaultVolume);
    player.autoplay = settings.defaultAutoplay;
    player.stayInChannel = settings.default247;
    player.setIdleTimeout(settings.idleTimeout);
    await player.refreshLocale();
  }
  return player;
}
function requesterOf(ctx) {
  return {
    id: ctx.author.id,
    tag: ctx.author.tag,
    avatar: ctx.author.displayAvatarURL({ size: 64 })
  };
}
function insertPosition(player, mode) {
  switch (mode) {
    case "top":
      return 0;
    case "next":
      return 0;
    default:
      return void 0;
  }
}
function engineNotReady(ctx) {
  return !ctx.client.shoukaku.getIdealNode();
}
async function resolveAndPlay(ctx, query, mode = "end") {
  await ctx.defer();
  const startedAt = Date.now();
  const log = (stage) => console.log(`[slux] /${ctx.interaction?.commandName ?? "play"} ${stage} (+${Date.now() - startedAt}ms)`);
  let player = null;
  try {
    player = await getOrCreatePlayer(ctx);
  } catch (err) {
    console.error("[slux] createPlayer failed (stale voice connection?):", err);
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.joinFailed"))] });
    return;
  }
  if (!player) {
    console.warn(
      `[slux] play rejected (no player): guild=${ctx.guild?.id ?? "?"} member=${!!ctx.member} voiceChannel=${ctx.member?.voice.channelId ?? "none"}`
    );
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noVoiceChannel"))] });
    return;
  }
  log("player ready");
  if (engineNotReady(ctx)) {
    console.warn("[slux] /play rejected: no Lavalink node connected (still starting or unreachable)");
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.engineNotReady"))] });
    return;
  }
  const outcome = await ctx.client.music.resolve(query, requesterOf(ctx));
  log(`resolve kind=${outcome.kind}`);
  if (outcome.kind === "empty" || outcome.kind === "error") {
    console.warn(
      `[slux] resolve failed for query "${query.slice(0, 80)}": kind=${outcome.kind}`
    );
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
    return;
  }
  if (outcome.kind === "track" && outcome.track) {
    await enqueueTrack(ctx, player, outcome.track, mode);
    return;
  }
  if (outcome.kind === "playlist" && outcome.tracks) {
    const position = insertPosition(player, mode);
    player.enqueueMany(outcome.tracks, position);
    if (!player.current) await player.startIfIdle();
    if (mode === "skip") await player.skip();
    const totalMs = outcome.tracks.reduce((a, t2) => a + t2.length, 0);
    const embed = baseEmbed().setAuthor({ name: `${EMOJI.playlist} ${ctx.t("music.playlistAddedTitle")}` }).setTitle((outcome.playlistName ?? "Playlist").slice(0, 250)).setDescription(ctx.t("music.addedPlaylist", { count: outcome.tracks.length, name: outcome.playlistName ?? "Playlist" })).addFields(
      {
        name: `${EMOJI.cd} ${ctx.t("music.queueTotal")}`,
        value: `\`${player.queue.length}\` ${ctx.t("common.tracks")}`,
        inline: true
      },
      {
        name: `${EMOJI.clock} ${ctx.t("music.totalDuration")}`,
        value: `\`${formatDuration(totalMs)}\``,
        inline: true
      }
    ).setFooter({
      text: `${ctx.t("common.requestedBy", { user: ctx.author.tag })} \u2022 ${EMOJI.playlist} Playlist`,
      iconURL: ctx.author.displayAvatarURL({ size: 64 })
    });
    const first = outcome.tracks[0];
    if (first?.artwork) embed.setThumbnail(first.artwork);
    await ctx.reply({ embeds: [embed] });
    return;
  }
  if (outcome.kind === "search" && outcome.tracks) {
    await presentSearchSelection(ctx, player, query, outcome.tracks, mode);
    return;
  }
}
async function enqueueTrack(ctx, player, track, mode) {
  const wasEmpty = !player.current;
  switch (mode) {
    case "top":
    case "next":
      player.enqueue(track, 0);
      await ctx.reply({
        embeds: [
          trackAddedEmbed(ctx.t, track, {
            position: 1,
            queueLength: player.queue.length,
            top: true
          })
        ]
      });
      break;
    case "skip": {
      player.enqueue(track, 0);
      if (player.current) {
        await player.skip();
        await ctx.reply({
          embeds: [
            baseEmbed().setAuthor({ name: `${EMOJI.skip} ${ctx.t("music.skipPlayTitle")}` }).setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title).setURL(track.uri || null).setDescription(`**${track.author}**`)
          ]
        });
      } else {
        await player.startIfIdle();
        await ctx.reply({
          embeds: [trackAddedEmbed(ctx.t, track, { queueLength: player.queue.length })]
        });
      }
      break;
    }
    default:
      player.enqueue(track);
      await ctx.reply({
        embeds: [
          trackAddedEmbed(ctx.t, track, {
            queueLength: player.queue.length
          })
        ]
      });
  }
  if (wasEmpty && mode === "end") await player.startIfIdle();
}
async function presentSearchSelection(ctx, player, query, tracks, _mode = "end") {
  const embed = baseEmbed().setAuthor({ name: `${EMOJI.music} ${ctx.t("music.searchResultsTitle")}` }).setDescription(
    `**${ctx.t("music.selectPrompt", { query: query.slice(0, 150) })}**

` + tracks.map(
      (track, i) => `\`${i + 1}.\` ${sourceEmoji(track.sourceName)} [${track.title}](${track.uri || "https://discord.com"}) \u2014 **${track.author}** \`[${track.isStream ? "LIVE" : formatDuration(track.length)}]\``
    ).join("\n")
  ).setFooter({
    text: `${EMOJI.clock} ${ctx.t("music.selectFooter")} \u2022 ${sourceLabel(tracks[0]?.sourceName ?? "")}`
  });
  const searchSessions = ctx.searchSessions;
  if (!searchSessions) {
    await ctx.reply({ embeds: [embed] });
    return;
  }
  const sessionId = Math.random().toString(36).slice(2, 10);
  const message = await ctx.reply({
    embeds: [embed],
    components: buildSearchSelectComponents(ctx.t, sessionId, tracks)
  });
  if (!message) return;
  const timeout = setTimeout(() => {
    searchSessions.delete(message.id);
    void message.edit({ embeds: [baseEmbed().setAuthor({ name: `${EMOJI.clock} ${ctx.t("common.timeUp")}` })], components: [] }).catch(() => {
    });
  }, 3e4);
  timeout.unref?.();
  searchSessions.set(message.id, {
    tracks,
    timeout,
    userId: ctx.author.id
  });
}

// src/bot/commands/music/play.ts
var playBase = {
  category: "music",
  permissions: { voice: true, sameVoice: true },
  aliases: []
};
var playCommand = {
  ...playBase,
  name: "play",
  descriptionKey: "commands.play.description",
  aliases: ["p"],
  options: [
    {
      name: "query",
      descriptionKey: "commands.play.options.query",
      type: "string",
      required: true,
      rest: true
    }
  ],
  async execute(ctx) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    await resolveAndPlay(ctx, query, "end");
  }
};
var playnextCommand = {
  ...playBase,
  name: "playnext",
  descriptionKey: "commands.playnext.description",
  aliases: ["pn"],
  options: [
    {
      name: "query",
      descriptionKey: "commands.playnext.options.query",
      type: "string",
      required: true,
      rest: true
    }
  ],
  async execute(ctx) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    await resolveAndPlay(ctx, query, "next");
  }
};
var playtopCommand = {
  ...playBase,
  name: "playtop",
  descriptionKey: "commands.playtop.description",
  aliases: ["pt"],
  options: [
    {
      name: "query",
      descriptionKey: "commands.playtop.options.query",
      type: "string",
      required: true,
      rest: true
    }
  ],
  async execute(ctx) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    await resolveAndPlay(ctx, query, "top");
  }
};
var playskipCommand = {
  ...playBase,
  name: "playskip",
  descriptionKey: "commands.playskip.description",
  aliases: ["ps"],
  options: [
    {
      name: "query",
      descriptionKey: "commands.playskip.options.query",
      type: "string",
      required: true,
      rest: true
    }
  ],
  async execute(ctx) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    await resolveAndPlay(ctx, query, "skip");
  }
};

// src/bot/lib/parse.ts
function parseTime(input) {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10) * 1e3;
  const colon = trimmed.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) {
    if (colon[3] !== void 0) {
      return (parseInt(colon[1], 10) * 3600 + parseInt(colon[2], 10) * 60 + parseInt(colon[3], 10)) * 1e3;
    }
    return (parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10)) * 1e3;
  }
  const units = trimmed.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i);
  if (units && (units[1] || units[2] || units[3])) {
    const h = parseInt(units[1] ?? "0", 10);
    const m = parseInt(units[2] ?? "0", 10);
    const s = parseInt(units[3] ?? "0", 10);
    return (h * 3600 + m * 60 + s) * 1e3;
  }
  return null;
}
function tokenize(content) {
  const tokens = [];
  let current = "";
  let inQuotes = false;
  for (const char of content) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === " " && !inQuotes) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

// src/bot/commands/music/controls.ts
function music(ctx) {
  return ctx.client.music;
}
var playerPermissions = { player: true, sameVoice: true, dj: true };
async function replyStatus(ctx, opts) {
  const player = music(ctx).getPlayer(ctx.guild.id);
  if (!player || opts.showButtons === false) {
    const embed = baseEmbed().setAuthor({ name: `${opts.emoji} ${opts.title}` });
    if (opts.description) embed.setDescription(opts.description);
    await ctx.reply({ embeds: [embed] });
    return;
  }
  await ctx.reply({
    embeds: [statusEmbed(ctx.t, player, opts)],
    components: controllerPayload(player, ctx.t).components
  });
}
var pauseCommand = {
  name: "pause",
  descriptionKey: "commands.pause.description",
  category: "music",
  aliases: [],
  permissions: playerPermissions,
  async execute(ctx) {
    const player = music(ctx).getPlayer(ctx.guild.id);
    if (player.paused) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.alreadyPaused"))] });
      return;
    }
    await player.pause();
    await replyStatus(ctx, { emoji: EMOJI.pause, title: ctx.t("music.pausedTitle"), description: ctx.t("music.paused") });
  }
};
var resumeCommand = {
  name: "resume",
  descriptionKey: "commands.resume.description",
  category: "music",
  aliases: ["unpause"],
  permissions: playerPermissions,
  async execute(ctx) {
    const player = music(ctx).getPlayer(ctx.guild.id);
    if (!player.paused) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notPaused"))] });
      return;
    }
    await player.resume();
    await replyStatus(ctx, { emoji: EMOJI.play, title: ctx.t("music.resumedTitle"), description: ctx.t("music.resumed") });
  }
};
var stopCommand = {
  name: "stop",
  descriptionKey: "commands.stop.description",
  category: "music",
  aliases: ["leave", "dc", "disconnect"],
  permissions: { player: true, sameVoice: true, dj: true },
  async execute(ctx) {
    await music(ctx).destroyPlayer(ctx.guild.id, "stopped");
    await ctx.reply({
      embeds: [
        baseEmbed().setAuthor({ name: `${EMOJI.stop} ${ctx.t("music.stoppedTitle")}` }).setDescription(ctx.t("music.stopped"))
      ]
    });
  }
};
var skipCommand = {
  name: "skip",
  descriptionKey: "commands.skip.description",
  category: "music",
  aliases: ["s", "sk", "fs"],
  permissions: playerPermissions,
  async execute(ctx) {
    const player = music(ctx).getPlayer(ctx.guild.id);
    const skipped = await player.skip();
    if (skipped) {
      await replyStatus(ctx, {
        emoji: EMOJI.skip,
        title: ctx.t("music.skippedTitle"),
        description: ctx.t("music.skipped", { title: `**${skipped.title}**` })
      });
    }
  }
};
var previousCommand = {
  name: "previous",
  descriptionKey: "commands.previous.description",
  category: "music",
  aliases: ["prev", "back"],
  permissions: playerPermissions,
  async execute(ctx) {
    const player = music(ctx).getPlayer(ctx.guild.id);
    const track = await player.previous();
    if (!track) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.noPrevious"))] });
      return;
    }
    await replyStatus(ctx, { emoji: EMOJI.previous, title: ctx.t("music.previousTitle"), description: ctx.t("music.previousNow") });
  }
};
var seekCommand = {
  name: "seek",
  descriptionKey: "commands.seek.description",
  category: "music",
  aliases: [],
  permissions: playerPermissions,
  options: [
    {
      name: "position",
      descriptionKey: "commands.seek.options.position",
      type: "string",
      required: true
    }
  ],
  async execute(ctx) {
    const player = music(ctx).getPlayer(ctx.guild.id);
    const raw = String(ctx.options.position ?? ctx.args[0] ?? "");
    const ms = parseTime(raw);
    if (ms === null) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }
    const ok = await player.seek(ms);
    if (!ok) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notSeekable"))] });
      return;
    }
    await replyStatus(ctx, {
      emoji: "\u{1F3AF}",
      title: ctx.t("music.seekedTitle"),
      description: ctx.t("music.seeked", { position: `**${formatDuration(ms)}**` })
    });
  }
};
var forwardCommand = {
  name: "forward",
  descriptionKey: "commands.forward.description",
  category: "music",
  aliases: ["fw"],
  permissions: playerPermissions,
  options: [
    {
      name: "seconds",
      descriptionKey: "commands.forward.options.seconds",
      type: "integer",
      required: true,
      min: 1,
      max: 3600
    }
  ],
  async execute(ctx) {
    const player = music(ctx).getPlayer(ctx.guild.id);
    const seconds = Number(ctx.options.seconds ?? ctx.args[0] ?? 10);
    const target = player.player.position + seconds * 1e3;
    const ok = await player.seek(target);
    if (!ok) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notSeekable"))] });
      return;
    }
    await replyStatus(ctx, {
      emoji: "\u23E9",
      title: ctx.t("music.forwardedTitle"),
      description: ctx.t("music.forwarded", { position: `**${formatDuration(target)}**` })
    });
  }
};
var rewindCommand = {
  name: "rewind",
  descriptionKey: "commands.rewind.description",
  category: "music",
  aliases: ["rw"],
  permissions: playerPermissions,
  options: [
    {
      name: "seconds",
      descriptionKey: "commands.rewind.options.seconds",
      type: "integer",
      required: true,
      min: 1,
      max: 3600
    }
  ],
  async execute(ctx) {
    const player = music(ctx).getPlayer(ctx.guild.id);
    const seconds = Number(ctx.options.seconds ?? ctx.args[0] ?? 10);
    const target = Math.max(0, player.player.position - seconds * 1e3);
    const ok = await player.seek(target);
    if (!ok) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notSeekable"))] });
      return;
    }
    await replyStatus(ctx, {
      emoji: "\u23EA",
      title: ctx.t("music.rewoundTitle"),
      description: ctx.t("music.rewound", { position: `**${formatDuration(target)}**` })
    });
  }
};
var replayCommand = {
  name: "replay",
  descriptionKey: "commands.replay.description",
  category: "music",
  aliases: ["re"],
  permissions: playerPermissions,
  async execute(ctx) {
    const player = music(ctx).getPlayer(ctx.guild.id);
    const ok = await player.seek(0);
    if (!ok) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notSeekable"))] });
      return;
    }
    await replyStatus(ctx, { emoji: "\u{1F501}", title: ctx.t("music.replayingTitle"), description: ctx.t("music.replaying") });
  }
};
var joinCommand = {
  name: "join",
  descriptionKey: "commands.join.description",
  category: "music",
  aliases: ["j", "summon"],
  permissions: { voice: true },
  async execute(ctx) {
    const player = await getOrCreatePlayer(ctx);
    if (!player) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.joinFailed"))] });
      return;
    }
    const channel = player.voiceChannel;
    await ctx.reply({
      embeds: [
        successEmbed(ctx.t, ctx.t("music.joined", { channel: `**${channel?.name ?? "voice"}**` }), ctx.t("music.joinedTitle"))
      ]
    });
  }
};

// src/bot/commands/music/queue.ts
function music2(ctx) {
  return ctx.client.music;
}
var playerPermissions2 = { player: true, sameVoice: true, dj: true };
var queueCommand = {
  name: "queue",
  descriptionKey: "commands.queue.description",
  category: "music",
  aliases: ["q", "que"],
  permissions: { player: true },
  options: [
    { name: "page", descriptionKey: "commands.queue.options.page", type: "integer", min: 1, max: 100 }
  ],
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    const page = Number(ctx.options.page ?? ctx.args[0] ?? 1) || 1;
    const { embed, components } = await buildQueueMessage(
      player,
      ctx.guild?.name ?? "",
      page,
      ctx.t,
      ctx.guild?.iconURL() ?? void 0
    );
    await ctx.reply({ embeds: [embed], components });
  }
};
var nowplayingCommand = {
  name: "nowplaying",
  descriptionKey: "commands.nowplaying.description",
  category: "music",
  aliases: ["np", "now"],
  permissions: { player: true },
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    if (!player.current) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    const snapshot = player.snapshot();
    await ctx.reply({
      embeds: [
        nowPlayingEmbed(ctx.t, player.current, {
          position: player.player.position,
          volume: player.volume,
          repeat: player.repeat,
          filters: snapshot.filters,
          paused: player.paused
        })
      ],
      components: controllerPayload(player, ctx.t).components
    });
  }
};
var removeCommand = {
  name: "remove",
  descriptionKey: "commands.remove.description",
  category: "music",
  aliases: ["rm"],
  permissions: playerPermissions2,
  options: [
    { name: "index", descriptionKey: "commands.remove.options.index", type: "integer", required: true, min: 1 }
  ],
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    const index = Number(ctx.options.index ?? ctx.args[0] ?? 0);
    const removed = player.removeAt(index);
    if (!removed) {
      await ctx.reply({
        embeds: [errorEmbed(ctx.t, ctx.t("music.invalidIndex", { index }))]
      });
      return;
    }
    const embed = baseEmbed().setAuthor({ name: `${EMOJI.error} ${ctx.t("music.removedTitle")}` }).setTitle(removed.title.length > 250 ? `${removed.title.slice(0, 247)}...` : removed.title).setURL(removed.uri || null).setDescription(`**${removed.author}** \u2022 \`#${index}\``).setFooter({
      text: `${ctx.t("common.requestedBy", { user: ctx.author.tag })} \u2022 ${sourceEmoji(removed.sourceName)} ${sourceLabel(removed.sourceName)}`,
      iconURL: ctx.author.displayAvatarURL({ size: 64 })
    });
    if (removed.artwork) embed.setThumbnail(removed.artwork);
    await ctx.reply({ embeds: [embed] });
  }
};
var clearCommand = {
  name: "clear",
  descriptionKey: "commands.clear.description",
  category: "music",
  aliases: [],
  permissions: playerPermissions2,
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    const count = player.clearQueue();
    await ctx.reply({
      embeds: [successEmbed(ctx.t, ctx.t("music.cleared", { count }), ctx.t("music.clearedTitle"))]
    });
  }
};
var moveCommand = {
  name: "move",
  descriptionKey: "commands.move.description",
  category: "music",
  aliases: ["mv"],
  permissions: playerPermissions2,
  options: [
    { name: "from", descriptionKey: "commands.move.options.from", type: "integer", required: true, min: 1 },
    { name: "to", descriptionKey: "commands.move.options.to", type: "integer", required: true, min: 1 }
  ],
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    const from = Number(ctx.options.from ?? ctx.args[0] ?? 0);
    const to = Number(ctx.options.to ?? ctx.args[1] ?? 0);
    const moved = player.moveTrack(from, to);
    if (!moved) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.invalidIndex", { index: from }))] });
      return;
    }
    const embed = baseEmbed().setAuthor({ name: `\u{1F4CC} ${ctx.t("music.movedTitle")}` }).setTitle(moved.title.length > 250 ? `${moved.title.slice(0, 247)}...` : moved.title).setURL(moved.uri || null).setDescription(
      `${ctx.t("music.moved", { title: `**${moved.title}**`, from, to })}

\`#${from}\` ${EMOJI.loopOff} \`#${to}\``
    );
    if (moved.artwork) embed.setThumbnail(moved.artwork);
    await ctx.reply({ embeds: [embed] });
  }
};
var shuffleCommand = {
  name: "shuffle",
  descriptionKey: "commands.shuffle.description",
  category: "music",
  aliases: ["sh", "mix"],
  permissions: playerPermissions2,
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    if (player.queue.length === 0) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.queueEmpty"))] });
      return;
    }
    const count = player.shuffleQueue();
    await ctx.reply({
      embeds: [
        successEmbed(ctx.t, ctx.t("music.shuffled", { count }), `${EMOJI.shuffle} ${ctx.t("music.shuffledTitle")}`)
      ]
    });
  }
};
var skipToCommand = {
  name: "skipto",
  descriptionKey: "commands.skipto.description",
  category: "music",
  aliases: ["st", "jump"],
  permissions: playerPermissions2,
  options: [
    {
      name: "index",
      descriptionKey: "commands.skipto.options.index",
      type: "integer",
      required: true,
      min: 1,
      max: 1e3
    }
  ],
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    const index = Number(ctx.options.index ?? ctx.args[0] ?? 0);
    const target = player.skipTo(index);
    if (!target) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.invalidIndex", { index }))] });
      return;
    }
    const embed = baseEmbed().setAuthor({ name: `\u23ED\uFE0F ${ctx.t("music.skiptoTitle")}` }).setTitle(target.title.length > 250 ? `${target.title.slice(0, 247)}...` : target.title).setURL(target.uri || null).setDescription(`**${target.author}**

${ctx.t("music.skiptoDone", { index: `\`#${index}\`` })}`);
    if (target.artwork) embed.setThumbnail(target.artwork);
    await ctx.reply({ embeds: [embed] });
  }
};
var removeDuplicatesCommand = {
  name: "removeduplicates",
  descriptionKey: "commands.removeduplicates.description",
  category: "music",
  aliases: ["rdup", "removedupes"],
  permissions: playerPermissions2,
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    if (player.queue.length === 0) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.queueEmpty"))] });
      return;
    }
    const removed = player.removeDuplicates();
    if (removed === 0) {
      await ctx.reply({
        embeds: [successEmbed(ctx.t, ctx.t("music.noDuplicates"), `${EMOJI.ok} ${ctx.t("music.removedDuplicatesTitle")}`)]
      });
      return;
    }
    await ctx.reply({
      embeds: [
        successEmbed(
          ctx.t,
          ctx.t("music.removedDuplicates", { count: removed }),
          `${EMOJI.ok} ${ctx.t("music.removedDuplicatesTitle")}`
        )
      ]
    });
  }
};
var loopCommand = {
  name: "loop",
  descriptionKey: "commands.loop.description",
  category: "music",
  aliases: ["l", "repeat"],
  permissions: playerPermissions2,
  options: [
    {
      name: "mode",
      descriptionKey: "commands.loop.options.mode",
      type: "string",
      choices: [
        { nameKey: "off", value: "off" },
        { nameKey: "track", value: "track" },
        { nameKey: "queue", value: "queue" }
      ]
    }
  ],
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    const raw = String(ctx.options.mode ?? ctx.args[0] ?? "");
    let mode;
    if (raw === "off" || raw === "track" || raw === "queue") {
      mode = raw;
    } else {
      mode = player.cycleRepeat();
    }
    await player.setRepeat(mode);
    await ctx.reply({
      embeds: [loopStatusEmbed(ctx.t, player)],
      components: loopRow(ctx.t, player)
    });
  }
};
var volumeCommand = {
  name: "volume",
  descriptionKey: "commands.volume.description",
  category: "music",
  aliases: ["vol", "v"],
  permissions: playerPermissions2,
  options: [
    { name: "level", descriptionKey: "commands.volume.options.level", type: "integer", min: 0, max: 150 }
  ],
  async execute(ctx) {
    const player = music2(ctx).getPlayer(ctx.guild.id);
    const raw = ctx.options.level ?? ctx.args[0];
    if (raw === void 0) {
      await ctx.reply({
        embeds: [volumeStatusEmbed(ctx.t, player)],
        components: volumeRow(ctx.t, player)
      });
      return;
    }
    const level = Number(raw);
    if (!Number.isFinite(level) || level < 0 || level > 150) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }
    await player.setVolume(level);
    await ctx.reply({
      embeds: [volumeStatusEmbed(ctx.t, player)],
      components: volumeRow(ctx.t, player)
    });
  }
};

// src/bot/commands/music/extras.ts
function music3(ctx) {
  return ctx.client.music;
}
var playerPermissions3 = { player: true, sameVoice: true, dj: true };
var searchCommand = {
  name: "search",
  descriptionKey: "commands.search.description",
  category: "music",
  aliases: ["find"],
  permissions: { voice: true, sameVoice: true },
  options: [
    {
      name: "query",
      descriptionKey: "commands.search.options.query",
      type: "string",
      required: true,
      rest: true
    }
  ],
  async execute(ctx) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    await ctx.defer();
    const startedAt = Date.now();
    let player;
    try {
      player = await getOrCreatePlayer(ctx);
    } catch (err) {
      console.error("[slux] createPlayer failed (stale voice connection?):", err);
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.joinFailed"))] });
      return;
    }
    if (!player) {
      console.warn(
        `[slux] search rejected (no player): guild=${ctx.guild?.id ?? "?"} member=${!!ctx.member} voiceChannel=${ctx.member?.voice.channelId ?? "none"}`
      );
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noVoiceChannel"))] });
      return;
    }
    if (engineNotReady(ctx)) {
      console.warn("[slux] /search rejected: no Lavalink node connected (still starting or unreachable)");
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.engineNotReady"))] });
      return;
    }
    const outcome = await music3(ctx).resolve(query, requesterOf(ctx), true);
    console.log(`[slux] /search resolve kind=${outcome.kind} (+${Date.now() - startedAt}ms)`);
    if (outcome.kind !== "search" && outcome.kind !== "track" || !outcome.tracks?.length) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    if (outcome.kind === "track" && outcome.track) {
      player.enqueue(outcome.track);
      if (!player.current) await player.startIfIdle();
      await ctx.reply({
        embeds: [trackAddedEmbed(ctx.t, outcome.track, { queueLength: player.queue.length })]
      });
      return;
    }
    await presentSearchSelection(ctx, player, query, outcome.tracks);
  }
};
var grabCommand = {
  name: "grab",
  descriptionKey: "commands.grab.description",
  category: "music",
  aliases: ["save"],
  permissions: { player: true },
  async execute(ctx) {
    const player = music3(ctx).getPlayer(ctx.guild.id);
    const track = player.current;
    if (!track) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    const embed = baseEmbed().setAuthor({ name: `${EMOJI.bookmark} ${ctx.t("music.grabTitle")}` }).setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title).setURL(track.uri || null).setDescription(`**${track.author}**`).addFields(
      {
        name: `${EMOJI.clock} ${ctx.t("music.npLength")}`,
        value: track.isStream ? `\u{1F534} ${ctx.t("music.live")}` : `\`${formatDuration(track.length)}\``,
        inline: true
      },
      {
        name: EMOJI.speaker,
        value: `<#${player.textChannelId ?? ctx.channel?.id}> \u2022 ${ctx.guild?.name ?? ""}`,
        inline: true
      },
      {
        name: `${sourceEmoji(track.sourceName)} ${ctx.t("music.grabSource")}`,
        value: sourceLabel(track.sourceName),
        inline: true
      }
    ).setFooter({
      text: `${ctx.t("common.requestedBy", { user: track.requesterTag })} \u2022 Slux`,
      iconURL: track.requesterAvatar || void 0
    });
    if (track.artwork) embed.setThumbnail(track.artwork);
    try {
      await ctx.author.send({ embeds: [embed] });
      await ctx.reply({
        embeds: [successEmbed(ctx.t, ctx.t("music.grabDmed"), `${EMOJI.bookmark} ${ctx.t("music.grabTitle")}`)]
      });
    } catch {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.grabDmFailed"))] });
    }
  }
};
var lyricsCommand = {
  name: "lyrics",
  descriptionKey: "commands.lyrics.description",
  category: "music",
  aliases: ["ly"],
  permissions: { player: true },
  async execute(ctx) {
    const player = music3(ctx).getPlayer(ctx.guild.id);
    const track = player.current;
    if (!track) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    await ctx.defer();
    await sendLyricsPaged({
      music: music3(ctx),
      pagination: ctx.pagination,
      player,
      t: ctx.t,
      track,
      send: async (payload) => await ctx.editReply(payload) ?? null
    });
  }
};
var autoplayCommand = {
  name: "autoplay",
  descriptionKey: "commands.autoplay.description",
  category: "music",
  aliases: ["ap"],
  permissions: playerPermissions3,
  async execute(ctx) {
    const player = music3(ctx).getPlayer(ctx.guild.id);
    player.autoplay = !player.autoplay;
    player.emit();
    await ctx.reply({
      embeds: [toggleStatusEmbed(ctx.t, "autoplay", player.autoplay)],
      components: toggleRow(ctx.t, "autoplay", player.autoplay)
    });
  }
};
var stayCommand = {
  name: "247",
  descriptionKey: "commands.247.description",
  category: "music",
  aliases: ["stay", "24/7"],
  permissions: playerPermissions3,
  async execute(ctx) {
    const player = music3(ctx).getPlayer(ctx.guild.id);
    player.stayInChannel = !player.stayInChannel;
    player.emit();
    await ctx.reply({
      embeds: [toggleStatusEmbed(ctx.t, "247", player.stayInChannel)],
      components: toggleRow(ctx.t, "247", player.stayInChannel)
    });
  }
};
var djModeCommand = {
  name: "djmode",
  descriptionKey: "commands.djmode.description",
  category: "music",
  aliases: ["dj"],
  permissions: playerPermissions3,
  async execute(ctx) {
    const player = music3(ctx).getPlayer(ctx.guild.id);
    player.djMode = !player.djMode;
    player.emit();
    await ctx.reply({
      embeds: [toggleStatusEmbed(ctx.t, "djmode", player.djMode)],
      components: toggleRow(ctx.t, "djmode", player.djMode)
    });
  }
};
var sleepCommand = {
  name: "sleep",
  descriptionKey: "commands.sleep.description",
  category: "music",
  aliases: ["timer"],
  permissions: playerPermissions3,
  options: [
    {
      name: "minutes",
      descriptionKey: "commands.sleep.options.minutes",
      type: "integer",
      min: 0,
      max: 600
    }
  ],
  async execute(ctx) {
    const player = music3(ctx).getPlayer(ctx.guild.id);
    const raw = String(ctx.args[0] ?? "").toLowerCase();
    const value = Number(ctx.options.minutes ?? ctx.args[0] ?? NaN);
    if (raw === "off" || raw === "stop" || raw === "cancel" || value === 0) {
      player.setSleepTimer(0);
      await ctx.reply({
        embeds: [successEmbed(ctx.t, ctx.t("music.sleepCancelled"), `${EMOJI.clock} ${ctx.t("music.sleepTitle")}`)]
      });
      return;
    }
    if (!Number.isFinite(value)) {
      if (player.sleepTimerUntil) {
        const minutes = Math.max(1, Math.ceil((player.sleepTimerUntil - Date.now()) / 6e4));
        await ctx.reply({
          embeds: [
            baseEmbed().setAuthor({ name: `${EMOJI.clock} ${ctx.t("music.sleepTitle")}` }).setDescription(ctx.t("music.sleepStatus", { minutes: `**${minutes}**` }))
          ]
        });
      } else {
        await ctx.reply({
          embeds: [baseEmbed().setAuthor({ name: `${EMOJI.clock} ${ctx.t("music.sleepTitle")}` }).setDescription(ctx.t("music.sleepNone"))]
        });
      }
      return;
    }
    if (value < 1 || value > 600) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }
    player.setSleepTimer(value);
    await ctx.reply({
      embeds: [
        successEmbed(
          ctx.t,
          ctx.t("music.sleepSet", { minutes: `**${value}**` }),
          `${EMOJI.clock} ${ctx.t("music.sleepTitle")}`
        )
      ]
    });
  }
};

// src/db/models/Playlist.ts
import mongoose3, { Schema as Schema2, model as model2 } from "mongoose";
var MAX_PLAYLIST_TRACKS = 1e3;
var playlistTrackSchema = new Schema2(
  {
    encoded: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, required: true },
    length: { type: Number, required: true },
    uri: { type: String, default: "" },
    artwork: { type: String, default: "" },
    sourceName: { type: String, default: "unknown" },
    isrc: { type: String, default: "" },
    identifier: { type: String, default: "" },
    isStream: { type: Boolean, default: false }
  },
  { _id: false }
);
var playlistSchema = new Schema2(
  {
    ownerId: { type: String, required: true, index: true },
    guildId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 64 },
    description: { type: String, default: "", maxlength: 256 },
    tracks: { type: [playlistTrackSchema], default: [] },
    public: { type: Boolean, default: false }
  },
  { timestamps: true }
);
playlistSchema.index({ ownerId: 1, name: 1 }, { unique: true });
var PlaylistModel = mongoose3.models.Playlist ?? model2("Playlist", playlistSchema);

// src/bot/commands/playlists/playlist.ts
function music4(ctx) {
  return ctx.client.music;
}
function playlistDocToTrack(doc) {
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
    requesterAvatar: ""
  };
}
function trackToDoc(track) {
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
    isStream: track.isStream
  };
}
async function replyPaged(ctx, totalPages, render) {
  if (!ctx.pagination) {
    await ctx.reply({ embeds: render(1).embeds });
    return;
  }
  const id = ctx.pagination.create(totalPages, render);
  const view = ctx.pagination.build(id, 1);
  const message = await ctx.reply(view);
  ctx.pagination.attach(id, message);
}
async function loadPlaylistIntoQueue(ctx, name, ownerId) {
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
  player.enqueueMany(playlist.tracks.map((t2) => ({ ...playlistDocToTrack(t2), ...requesterMeta(requester) })));
  if (!player.current) await player.startIfIdle();
  const totalMs = playlist.tracks.reduce((a, t2) => a + t2.length, 0);
  const embed = baseEmbed().setAuthor({ name: `${EMOJI.playlist} ${ctx.t("playlists.loadedTitle")}` }).setTitle(name.slice(0, 250)).setDescription(ctx.t("playlists.loaded", { count: playlist.tracks.length, name })).addFields(
    {
      name: `${EMOJI.cd} ${ctx.t("music.queueTotal")}`,
      value: `\`${player.queue.length}\` ${ctx.t("common.tracks")}`,
      inline: true
    },
    { name: `${EMOJI.clock} ${ctx.t("music.totalDuration")}`, value: `\`${formatDuration(totalMs)}\``, inline: true }
  ).setFooter({ text: `${ctx.t("common.requestedBy", { user: ctx.author.tag })}`, iconURL: ctx.author.displayAvatarURL({ size: 64 }) });
  const first = playlist.tracks[0];
  if (first?.artwork) embed.setThumbnail(first.artwork);
  await ctx.reply({ embeds: [embed] });
}
function requesterMeta(requester) {
  return {
    requesterId: requester.id,
    requesterTag: requester.tag,
    requesterAvatar: requester.avatar
  };
}
async function addQueryToPlaylist(ctx, playlistName, query) {
  const playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name: playlistName });
  if (!playlist) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.notFound", { name: playlistName }))] });
    return;
  }
  const outcome = await music4(ctx).resolve(query, requesterOf(ctx));
  if (outcome.kind === "empty" || outcome.kind === "error") {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
    return;
  }
  if (outcome.kind === "track" && outcome.track) {
    if (playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
      await ctx.reply({
        embeds: [errorEmbed(ctx.t, ctx.t("playlists.limitReached", { limit: MAX_PLAYLIST_TRACKS }))]
      });
      return;
    }
    playlist.tracks.push(trackToDoc(outcome.track));
    await playlist.save();
    await ctx.reply({
      embeds: [addedTrackEmbed(ctx, playlistName, outcome.track, playlist.tracks.length)]
    });
    return;
  }
  if (outcome.kind === "playlist" && outcome.tracks) {
    if (playlist.tracks.length + outcome.tracks.length > MAX_PLAYLIST_TRACKS) {
      await ctx.reply({
        embeds: [errorEmbed(ctx.t, ctx.t("playlists.tooManyToAdd", { limit: MAX_PLAYLIST_TRACKS }))]
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
          `${EMOJI.playlist} ${ctx.t("playlists.addedTitle")}`
        )
      ]
    });
    return;
  }
  if (outcome.kind === "search" && outcome.tracks && outcome.tracks.length > 0) {
    const track = outcome.tracks[0];
    if (playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
      await ctx.reply({
        embeds: [errorEmbed(ctx.t, ctx.t("playlists.limitReached", { limit: MAX_PLAYLIST_TRACKS }))]
      });
      return;
    }
    playlist.tracks.push(trackToDoc(track));
    await playlist.save();
    await ctx.reply({ embeds: [addedTrackEmbed(ctx, playlistName, track, playlist.tracks.length)] });
  }
}
function addedTrackEmbed(ctx, playlistName, track, total) {
  const embed = baseEmbed().setAuthor({ name: `${EMOJI.added} ${ctx.t("playlists.addedTitle")}` }).setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title).setURL(track.uri || null).setDescription(`**${track.author}** \u2192 \u{1F4C1} **${playlistName}**`).addFields({
    name: `${EMOJI.cd} ${ctx.t("playlists.infoTitle", { name: playlistName })}`,
    value: `\`${total}\` ${ctx.t("common.tracks")}`,
    inline: true
  }).setFooter({ text: ctx.author.tag, iconURL: ctx.author.displayAvatarURL({ size: 64 }) });
  if (track.artwork) embed.setThumbnail(track.artwork);
  return embed;
}
async function replyPlaylistList(ctx) {
  const playlists = await PlaylistModel.find({ ownerId: ctx.author.id }).limit(200);
  if (playlists.length === 0) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.listEmpty"))] });
    return;
  }
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(playlists.length / perPage));
  const t2 = ctx.t;
  const author = ctx.author;
  const render = (page) => {
    const start = (page - 1) * perPage;
    const items = playlists.slice(start, start + perPage);
    const embed = baseEmbed().setAuthor({ name: `${EMOJI.playlist} ${t2("playlists.listTitle")}`, iconURL: author.displayAvatarURL({ size: 64 }) }).setDescription(
      items.map((p) => {
        const duration = p.tracks.reduce((a, tr) => a + tr.length, 0);
        const visibility = p.public ? `\u{1F513} ${t2("playlists.public")}` : `\u{1F512} ${t2("playlists.private")}`;
        const desc = p.description ? `
> *${p.description.slice(0, 90)}*` : "";
        return `**${p.name}** ${visibility}
> ${EMOJI.cd} \`${p.tracks.length}\` ${t2("common.tracks")} \u2022 ${EMOJI.clock} \`${formatDuration(duration)}\`${desc}`;
      }).join("\n\n")
    ).setFooter({ text: `${t2("common.page", { current: page, total: totalPages })} \u2022 ${playlists.length} ${t2("playlists.listTitle").toLowerCase()}` });
    return { embeds: [embed] };
  };
  await replyPaged(ctx, totalPages, render);
}
async function replyPlaylistInfo(ctx, name) {
  const playlist = await PlaylistModel.findOne({ ownerId: ctx.author.id, name });
  if (!playlist) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.notFound", { name }))] });
    return;
  }
  const totalMs = playlist.tracks.reduce((a, t3) => a + t3.length, 0);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(playlist.tracks.length / perPage));
  const t2 = ctx.t;
  const tracks = [...playlist.tracks];
  const render = (page) => {
    const start = (page - 1) * perPage;
    const items = tracks.slice(start, start + perPage);
    const embed = baseEmbed().setAuthor({ name: `${EMOJI.playlist} ${t2("playlists.infoTitle", { name })}` }).setDescription(
      playlist.tracks.length === 0 ? t2("playlists.empty", { name }) : items.map((tr, i) => trackLine(playlistDocToTrack(tr), start + i + 1)).join("\n").slice(0, 3900)
    ).setFooter({
      text: `${t2("playlists.infoFooter", {
        count: playlist.tracks.length,
        duration: formatDuration(totalMs),
        visibility: playlist.public ? t2("playlists.public") : t2("playlists.private")
      })} \u2022 ${t2("common.page", { current: page, total: totalPages })}`
    });
    return { embeds: [embed] };
  };
  await replyPaged(ctx, totalPages, render);
}
var playlistCommand = {
  name: "playlist",
  descriptionKey: "commands.playlist.description",
  category: "playlists",
  aliases: ["pl"],
  subcommands: [
    { name: "create", descriptionKey: "commands.playlist.subcommands.create.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.create.options.name", type: "string", required: true, rest: true }] },
    { name: "delete", descriptionKey: "commands.playlist.subcommands.delete.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.delete.options.name", type: "string", required: true, rest: true }] },
    { name: "rename", descriptionKey: "commands.playlist.subcommands.rename.description", options: [
      { name: "old", descriptionKey: "commands.playlist.subcommands.rename.options.old", type: "string", required: true },
      { name: "new", descriptionKey: "commands.playlist.subcommands.rename.options.new", type: "string", required: true, rest: true }
    ] },
    { name: "add", descriptionKey: "commands.playlist.subcommands.add.description", options: [
      { name: "name", descriptionKey: "commands.playlist.subcommands.add.options.name", type: "string", required: true },
      { name: "query", descriptionKey: "commands.playlist.subcommands.add.options.query", type: "string", required: true, rest: true }
    ] },
    { name: "remove", descriptionKey: "commands.playlist.subcommands.remove.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.remove.options.name", type: "string", required: true }, { name: "index", descriptionKey: "commands.playlist.subcommands.remove.options.index", type: "integer", required: true, min: 1 }] },
    { name: "list", descriptionKey: "commands.playlist.subcommands.list.description" },
    { name: "info", descriptionKey: "commands.playlist.subcommands.info.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.info.options.name", type: "string", required: true, rest: true }] },
    { name: "load", descriptionKey: "commands.playlist.subcommands.load.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.load.options.name", type: "string", required: true, rest: true }] },
    { name: "public", descriptionKey: "commands.playlist.subcommands.public.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.public.options.name", type: "string", required: true, rest: true }] },
    { name: "save", descriptionKey: "commands.playlist.subcommands.save.description", options: [{ name: "name", descriptionKey: "commands.playlist.subcommands.save.options.name", type: "string", required: true, rest: true }] }
  ],
  async execute(ctx) {
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
          embeds: [successEmbed(ctx.t, ctx.t("playlists.created", { name }), `${EMOJI.playlist} ${ctx.t("playlists.createdTitle")}`)]
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
            baseEmbed().setAuthor({ name: `${EMOJI.error} ${ctx.t("playlists.deletedTitle")}` }).setDescription(ctx.t("playlists.deleted", { name }))
          ]
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
            successEmbed(ctx.t, ctx.t("playlists.renamed", { old: oldName, new: newName }), `${EMOJI.playlist} ${ctx.t("playlists.renamedTitle")}`)
          ]
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
            baseEmbed().setAuthor({ name: `${EMOJI.error} ${ctx.t("playlists.removedTrackTitle")}` }).setDescription(ctx.t("playlists.removedTrack", { title: `**${removed?.title ?? "?"}**`, name }))
          ]
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
            baseEmbed().setAuthor({ name: `${playlist.public ? "\u{1F513}" : "\u{1F512}"} ${ctx.t("playlists.visibilityTitle")}` }).setDescription(
              `${playlist.public ? "\u{1F513}" : "\u{1F512}"} **${name}** \u2014 ${playlist.public ? ctx.t("playlists.public") : ctx.t("playlists.private")}`
            )
          ]
        });
        return;
      }
      case "save": {
        const name = String(ctx.options.name ?? "").trim();
        if (!name || name.length > 64) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.nameTooLong"))] });
          return;
        }
        const player = music4(ctx).getPlayer(ctx.guild?.id ?? "");
        const tracks = [];
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
                `${EMOJI.playlist} ${ctx.t("playlists.savedQueueTitle")}`
              )
            ]
          });
          return;
        }
        await PlaylistModel.create({ ownerId: ctx.author.id, name, tracks: docs });
        await ctx.reply({
          embeds: [
            successEmbed(
              ctx.t,
              ctx.t("playlists.savedQueue", { name, count: docs.length }),
              `${EMOJI.playlist} ${ctx.t("playlists.savedQueueTitle")}`
            )
          ]
        });
        return;
      }
      default:
        await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.unknownCommand"))] });
    }
  }
};
var FAVORITES = "Favorites";
var favoritesCommand = {
  name: "favorites",
  descriptionKey: "commands.favorites.description",
  category: "playlists",
  aliases: ["fav", "favourites"],
  subcommands: [
    { name: "add", descriptionKey: "commands.favorites.subcommands.add.description", options: [{ name: "query", descriptionKey: "commands.favorites.subcommands.add.options.query", type: "string", rest: true }] },
    { name: "remove", descriptionKey: "commands.favorites.subcommands.remove.description", options: [{ name: "index", descriptionKey: "commands.favorites.subcommands.remove.options.index", type: "integer", required: true, min: 1 }] },
    { name: "list", descriptionKey: "commands.favorites.subcommands.list.description" },
    { name: "play", descriptionKey: "commands.favorites.subcommands.play.description" }
  ],
  async execute(ctx) {
    const sub = ctx.subcommand ?? "";
    switch (sub) {
      case "add": {
        const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
        let track = null;
        if (!query) {
          const player = music4(ctx).getPlayer(ctx.guild?.id ?? "");
          track = player?.current ?? null;
          if (!track) {
            await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("playlists.noCurrent"))] });
            return;
          }
        } else {
          const outcome = await music4(ctx).resolve(query, requesterOf(ctx));
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
            embeds: [errorEmbed(ctx.t, ctx.t("playlists.limitReached", { limit: MAX_PLAYLIST_TRACKS }))]
          });
          return;
        }
        playlist.tracks.push(trackToDoc(track));
        await playlist.save();
        await ctx.reply({
          embeds: [
            successEmbed(ctx.t, ctx.t("playlists.favoritesAdded", { title: `**${track.title}**` }), `${EMOJI.heart} ${ctx.t("playlists.favorites")}`)
          ]
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
            baseEmbed().setAuthor({ name: `${EMOJI.error} ${ctx.t("playlists.favorites")}` }).setDescription(ctx.t("playlists.favoritesRemoved", { title: `**${removed?.title ?? "?"}**` }))
          ]
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
        const t2 = ctx.t;
        const tracks = [...playlist.tracks];
        const render = (page) => {
          const start = (page - 1) * perPage;
          const items = tracks.slice(start, start + perPage);
          const embed = baseEmbed().setAuthor({ name: `${EMOJI.heart} ${t2("playlists.favorites")}`, iconURL: ctx.author.displayAvatarURL({ size: 64 }) }).setDescription(items.map((tr, i) => trackLine(playlistDocToTrack(tr), start + i + 1)).join("\n").slice(0, 3900)).setFooter({
            text: `${playlist.tracks.length} ${t2("common.tracks")} \u2022 ${t2("common.page", { current: page, total: totalPages })}`
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
  }
};

// src/bot/commands/filters/index.ts
import { ActionRowBuilder as ActionRowBuilder4, ButtonBuilder as ButtonBuilder4, ButtonStyle as ButtonStyle4 } from "discord.js";

// src/bot/lib/filtersview.ts
import {
  ActionRowBuilder as ActionRowBuilder3,
  ButtonBuilder as ButtonBuilder3,
  ButtonStyle as ButtonStyle3,
  StringSelectMenuBuilder as StringSelectMenuBuilder3
} from "discord.js";
function buildFiltersPanel(player, t2) {
  const active = player.snapshot().filters;
  const embed = baseEmbed().setAuthor({ name: `${EMOJI.filters} ${t2("filters.panelTitle")}` }).setDescription(t2("filters.panelHint"));
  if (active.length === 0) {
    embed.addFields({ name: t2("filters.listTitle"), value: t2("filters.listNone"), inline: false });
  } else {
    embed.addFields({
      name: t2("filters.listTitle"),
      value: active.map((f) => `${filterEmoji(f)} **${f}** \u2014 ${t2("common.on")}`).join("\n"),
      inline: false
    });
  }
  const track = player.current;
  if (track) {
    embed.setThumbnail(track.artwork || null);
    embed.setFooter({
      text: `${EMOJI.music} ${track.title}`.slice(0, 200)
    });
  }
  const menu = new StringSelectMenuBuilder3().setCustomId("slux:fx").setPlaceholder(t2("filters.pickPlaceholder")).setMinValues(1).setMaxValues(1).addOptions(
    TOGGLEABLE_FILTERS.map((filter) => {
      const isActive = active.includes(filter);
      return {
        label: filter.charAt(0).toUpperCase() + filter.slice(1),
        value: filter,
        description: (isActive ? t2("filters.stateOn") : t2("filters.stateOff")).slice(0, 100),
        emoji: filterEmoji(filter),
        default: isActive
      };
    })
  );
  const row1 = new ActionRowBuilder3().addComponents(menu);
  const row2 = new ActionRowBuilder3().addComponents(
    new ButtonBuilder3().setCustomId("slux:fxreset").setLabel(t2("filters.resetAll")).setEmoji("\u21A9\uFE0F").setStyle(ButtonStyle3.Danger)
  );
  return { embeds: [embed], components: [row1, row2] };
}
async function handleFilterSelect(interaction, player, t2, nameRaw) {
  const name = TOGGLEABLE_FILTERS.includes(nameRaw) ? nameRaw : null;
  if (!name) return;
  if (name === "bassboost" && !player.hasFilter("bassboost")) {
    await player.applyFilter("bassboost", BASSBOOST_LEVELS.medium);
  } else if (player.hasFilter(name)) {
    await player.removeFilter(name);
  } else {
    await player.applyFilter(name);
  }
  await interaction.update(buildFiltersPanel(player, t2)).catch(() => {
  });
}
async function handleFilterReset(interaction, player, t2) {
  await player.resetFilters();
  await interaction.update(buildFiltersPanel(player, t2)).catch(() => {
  });
}

// src/bot/commands/filters/index.ts
function music5(ctx) {
  return ctx.client.music;
}
var playerPermissions4 = { player: true, sameVoice: true, dj: true };
function filterPanelRow(t2) {
  return [
    new ActionRowBuilder4().addComponents(
      new ButtonBuilder4().setCustomId("slux:fxopen").setLabel(t2("filters.openPanel")).setEmoji(EMOJI.filters).setStyle(ButtonStyle4.Primary)
    )
  ];
}
async function toggleFilter(ctx, filter, value) {
  const player = music5(ctx).getPlayer(ctx.guild.id);
  if (!player) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
    return;
  }
  const emoji = filterEmoji(filter);
  if (player.hasFilter(filter)) {
    await player.removeFilter(filter);
    await ctx.reply({
      embeds: [
        baseEmbed().setAuthor({ name: `${emoji} ${ctx.t("filters.removedTitle")}` }).setDescription(ctx.t("filters.removed", { name: `**${filter}**` }))
      ],
      components: filterPanelRow(ctx.t)
    });
    return;
  }
  await player.applyFilter(filter, value);
  await ctx.reply({
    embeds: [
      successEmbed(ctx.t, ctx.t("filters.applied", { name: `**${filter}**` }), `${emoji} ${ctx.t("filters.appliedTitle")}`)
    ],
    components: filterPanelRow(ctx.t)
  });
}
function simpleFilterCommand(name, descriptionKey, filter, aliases = []) {
  return {
    name,
    descriptionKey,
    category: "filters",
    aliases,
    permissions: playerPermissions4,
    async execute(ctx) {
      await toggleFilter(ctx, filter);
    }
  };
}
var bassboostCommand = {
  name: "bassboost",
  descriptionKey: "commands.bassboost.description",
  category: "filters",
  aliases: ["bass", "bb"],
  permissions: playerPermissions4,
  options: [
    {
      name: "level",
      descriptionKey: "commands.bassboost.options.level",
      type: "string",
      choices: [
        { nameKey: "low", value: "low" },
        { nameKey: "medium", value: "medium" },
        { nameKey: "high", value: "high" },
        { nameKey: "insane", value: "insane" }
      ]
    }
  ],
  async execute(ctx) {
    const level = String(ctx.options.level ?? ctx.args[0] ?? "medium").toLowerCase();
    if (!(level in BASSBOOST_LEVELS)) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("filters.invalidLevel"))] });
      return;
    }
    await toggleFilter(ctx, "bassboost", BASSBOOST_LEVELS[level]);
  }
};
var nightcoreCommand = simpleFilterCommand("nightcore", "commands.nightcore.description", "nightcore", ["nc"]);
var vaporwaveCommand = simpleFilterCommand("vaporwave", "commands.vaporwave.description", "vaporwave", ["vw"]);
var softCommand = simpleFilterCommand("soft", "commands.soft.description", "soft");
var eightDCommand = simpleFilterCommand("8d", "commands.8d.description", "8d", ["eightd"]);
var karaokeCommand = simpleFilterCommand("karaoke", "commands.karaoke.description", "karaoke");
var tremoloCommand = simpleFilterCommand("tremolo", "commands.tremolo.description", "tremolo");
var vibratoCommand = simpleFilterCommand("vibrato", "commands.vibrato.description", "vibrato");
var distortionCommand = simpleFilterCommand("distortion", "commands.distortion.description", "distortion");
var lowpassCommand = simpleFilterCommand("lowpass", "commands.lowpass.description", "lowpass", ["lp"]);
async function timescaleCommand(ctx, kind) {
  const player = music5(ctx).getPlayer(ctx.guild.id);
  if (!player) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
    return;
  }
  const raw = ctx.options.value ?? ctx.args[0];
  if (raw === void 0) {
    await player.removeFilter(kind === "speed" ? "speed" : "pitch");
    await ctx.reply({
      embeds: [
        baseEmbed().setAuthor({ name: `${filterEmoji(kind)} ${ctx.t("filters.removedTitle")}` }).setDescription(ctx.t("filters.removed", { name: `**${kind}**` }))
      ],
      components: filterPanelRow(ctx.t)
    });
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.5 || value > 5) {
    await ctx.reply({
      embeds: [errorEmbed(ctx.t, ctx.t("filters.invalidValue", { min: 0.5, max: 5 }))]
    });
    return;
  }
  await player.applyFilter(kind, value);
  await ctx.reply({
    embeds: [
      successEmbed(
        ctx.t,
        ctx.t("filters.applied", { name: `**${kind} ${value}x**` }),
        `${filterEmoji(kind)} ${ctx.t("filters.appliedTitle")}`
      )
    ],
    components: filterPanelRow(ctx.t)
  });
}
var speedCommand = {
  name: "speed",
  descriptionKey: "commands.speed.description",
  category: "filters",
  aliases: [],
  permissions: playerPermissions4,
  options: [
    { name: "value", descriptionKey: "commands.speed.options.value", type: "number", required: true, min: 0.5, max: 5 }
  ],
  async execute(ctx) {
    await timescaleCommand(ctx, "speed");
  }
};
var pitchCommand = {
  name: "pitch",
  descriptionKey: "commands.pitch.description",
  category: "filters",
  aliases: [],
  permissions: playerPermissions4,
  options: [
    { name: "value", descriptionKey: "commands.pitch.options.value", type: "number", required: true, min: 0.5, max: 5 }
  ],
  async execute(ctx) {
    await timescaleCommand(ctx, "pitch");
  }
};
var eqCommand = {
  name: "eq",
  descriptionKey: "commands.eq.description",
  category: "filters",
  aliases: ["equalizer"],
  permissions: playerPermissions4,
  options: [
    {
      name: "bands",
      descriptionKey: "commands.eq.options.bands",
      type: "string",
      required: true,
      rest: true
    }
  ],
  async execute(ctx) {
    const player = music5(ctx).getPlayer(ctx.guild.id);
    if (!player) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    const raw = String(ctx.options.bands ?? ctx.args.join(" ") ?? "").trim().split(/[\s,]+/).map((v) => parseFloat(v)).filter((v) => Number.isFinite(v));
    if (raw.length === 0 || raw.length > 15 || raw.some((v) => v < -1 || v > 1)) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("filters.eqUsage", { prefix: ctx.prefix }))] });
      return;
    }
    await player.applyFilter("eq", raw);
    await ctx.reply({
      embeds: [
        successEmbed(ctx.t, ctx.t("filters.eqApplied"), `${filterEmoji("eq")} ${ctx.t("filters.appliedTitle")}`)
      ],
      components: filterPanelRow(ctx.t)
    });
  }
};
var filtersCommand = {
  name: "filters",
  descriptionKey: "commands.filters.description",
  category: "filters",
  aliases: ["fx"],
  permissions: { player: true },
  async execute(ctx) {
    const player = music5(ctx).getPlayer(ctx.guild.id);
    if (!player) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    const panel = buildFiltersPanel(player, ctx.t);
    await ctx.reply(panel);
  }
};
var filtersResetCommand = {
  name: "reset",
  descriptionKey: "commands.filtersreset.description",
  category: "filters",
  aliases: ["resetfilters", "clearfilters"],
  permissions: playerPermissions4,
  async execute(ctx) {
    const player = music5(ctx).getPlayer(ctx.guild.id);
    if (!player) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    await player.resetFilters();
    await ctx.reply({ embeds: [successEmbed(ctx.t, ctx.t("filters.reset"), `${EMOJI.filters} ${ctx.t("filters.resetTitle")}`)] });
  }
};

// src/bot/commands/settings/index.ts
var settingsCommand = {
  name: "settings",
  descriptionKey: "commands.settings.description",
  category: "settings",
  aliases: ["config"],
  permissions: { manageGuild: true },
  async execute(ctx) {
    const settings = await getGuildSettings(ctx.guild.id);
    const t2 = ctx.t;
    const embed = baseEmbed().setAuthor({
      name: `${EMOJI.settings} ${t2("settings.title", { guild: ctx.guild?.name ?? "" })}`,
      iconURL: ctx.guild?.iconURL() ?? void 0
    }).addFields(
      { name: `\u2328\uFE0F ${t2("settings.prefix")}`, value: `\`${settings.prefix}\``, inline: true },
      { name: `${EMOJI.globe} ${t2("settings.language")}`, value: localeLabel(normalizeLocale(settings.language)), inline: true },
      { name: `${EMOJI.volume} ${t2("settings.defaultVolume")}`, value: `\`${settings.defaultVolume}%\``, inline: true },
      {
        name: `${EMOJI.autoplay} ${t2("settings.autoplay")}`,
        value: settings.defaultAutoplay ? `${EMOJI.ok} ${t2("common.enabled")}` : `${EMOJI.error} ${t2("common.disabled")}`,
        inline: true
      },
      {
        name: `${EMOJI.infinity} ${t2("settings.247")}`,
        value: settings.default247 ? `${EMOJI.ok} ${t2("common.enabled")}` : `${EMOJI.error} ${t2("common.disabled")}`,
        inline: true
      },
      {
        name: `${EMOJI.clock} ${t2("settings.idleTimeout")}`,
        value: settings.idleTimeout > 0 ? `\`${settings.idleTimeout} ${t2("common.minutes")}\`` : `\u267E\uFE0F ${t2("settings.noTimeout")}`,
        inline: true
      },
      {
        name: `${EMOJI.dj} ${t2("settings.djRoles")}`,
        value: settings.djRoles.length > 0 ? settings.djRoles.map((r) => `<@&${r}>`).join(" ") : `*${t2("common.none")}*`,
        inline: false
      },
      {
        name: `#\uFE0F\u20E3 ${t2("settings.botChannels")}`,
        value: settings.botChannels.length > 0 ? settings.botChannels.map((c) => `<#${c}>`).join(" ") : `*${t2("settings.allChannels")}*`,
        inline: false
      }
    ).setFooter({ text: `Slux \u2022 ${ctx.guild?.name ?? ""}` });
    await ctx.reply({ embeds: [embed] });
  }
};
var prefixCommand = {
  name: "prefix",
  descriptionKey: "commands.prefix.description",
  category: "settings",
  aliases: [],
  permissions: { manageGuild: true },
  options: [
    { name: "prefix", descriptionKey: "commands.prefix.options.prefix", type: "string", required: true }
  ],
  async execute(ctx) {
    const prefix = String(ctx.options.prefix ?? ctx.args[0] ?? "").trim();
    if (!prefix || prefix.length > 5 || /\s/.test(prefix)) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.prefixInvalid"))] });
      return;
    }
    await updateGuildSettings(ctx.guild.id, { prefix });
    invalidateGuildCache(ctx.guild.id);
    await ctx.reply({
      embeds: [successEmbed(ctx.t, ctx.t("settings.prefixSet", { prefix }))]
    });
  }
};
var languageCommand = {
  name: "language",
  descriptionKey: "commands.language.description",
  category: "settings",
  aliases: ["lang"],
  permissions: { manageGuild: true },
  options: [
    {
      name: "language",
      descriptionKey: "commands.language.options.language",
      type: "string",
      required: true,
      choices: localeChoices().map((c) => ({ nameKey: c.name, value: c.value }))
    }
  ],
  async execute(ctx) {
    const raw = String(ctx.options.language ?? ctx.args[0] ?? "").toLowerCase();
    const locale = normalizeLocale(raw);
    if (raw !== locale && !LOCALES.some((l) => l.code === raw)) {
      await ctx.reply({
        embeds: [
          errorEmbed(
            ctx.t,
            ctx.t("settings.languageInvalid", { languages: LOCALES.map((l) => l.code).join(", ") })
          )
        ]
      });
      return;
    }
    await updateGuildSettings(ctx.guild.id, { language: locale });
    invalidateGuildCache(ctx.guild.id);
    const newT = createTranslator(locale);
    await ctx.reply({
      embeds: [successEmbed(newT, newT("settings.languageSet", { language: localeLabel(locale) }))]
    });
  }
};
var djRoleCommand = {
  name: "djrole",
  descriptionKey: "commands.djrole.description",
  category: "settings",
  aliases: [],
  permissions: { manageGuild: true },
  subcommands: [
    { name: "add", descriptionKey: "commands.djrole.subcommands.add.description", options: [{ name: "role", descriptionKey: "commands.djrole.subcommands.add.options.role", type: "role", required: true }] },
    { name: "remove", descriptionKey: "commands.djrole.subcommands.remove.description", options: [{ name: "role", descriptionKey: "commands.djrole.subcommands.remove.options.role", type: "role", required: true }] },
    { name: "list", descriptionKey: "commands.djrole.subcommands.list.description" }
  ],
  async execute(ctx) {
    const settings = await getGuildSettings(ctx.guild.id);
    switch (ctx.subcommand) {
      case "add": {
        const roleId = String(ctx.options.role ?? ctx.args[0] ?? "");
        if (settings.djRoles.includes(roleId)) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.djRoleNotSet"))] });
          return;
        }
        await updateGuildSettings(ctx.guild.id, { djRoles: [...settings.djRoles, roleId] });
        await ctx.reply({
          embeds: [successEmbed(ctx.t, ctx.t("settings.djRoleAdded", { role: `<@&${roleId}>` }))]
        });
        return;
      }
      case "remove": {
        const roleId = String(ctx.options.role ?? ctx.args[0] ?? "");
        if (!settings.djRoles.includes(roleId)) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.djRoleNotSet"))] });
          return;
        }
        await updateGuildSettings(ctx.guild.id, { djRoles: settings.djRoles.filter((r) => r !== roleId) });
        await ctx.reply({
          embeds: [successEmbed(ctx.t, ctx.t("settings.djRoleRemoved", { role: `<@&${roleId}>` }))]
        });
        return;
      }
      case "list":
      default: {
        if (settings.djRoles.length === 0) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.djRoleNone"))] });
          return;
        }
        await ctx.reply({
          embeds: [
            baseEmbed().setAuthor({ name: `${EMOJI.dj} ${ctx.t("settings.djRoles")}` }).setDescription(
              settings.djRoles.map((r) => `<@&${r}>`).join(" \u2022 ")
            )
          ]
        });
        return;
      }
    }
  }
};
var botChannelCommand = {
  name: "botchannel",
  descriptionKey: "commands.botchannel.description",
  category: "settings",
  aliases: [],
  permissions: { manageGuild: true },
  subcommands: [
    { name: "add", descriptionKey: "commands.botchannel.subcommands.add.description", options: [{ name: "channel", descriptionKey: "commands.botchannel.subcommands.add.options.channel", type: "channel", required: true }] },
    { name: "remove", descriptionKey: "commands.botchannel.subcommands.remove.description", options: [{ name: "channel", descriptionKey: "commands.botchannel.subcommands.remove.options.channel", type: "channel", required: true }] },
    { name: "clear", descriptionKey: "commands.botchannel.subcommands.clear.description" }
  ],
  async execute(ctx) {
    const settings = await getGuildSettings(ctx.guild.id);
    switch (ctx.subcommand) {
      case "add": {
        const channelId = String(ctx.options.channel ?? ctx.args[0] ?? "").replace(/[<#>]/g, "");
        if (settings.botChannels.includes(channelId)) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.botChannelNotSet"))] });
          return;
        }
        await updateGuildSettings(ctx.guild.id, { botChannels: [...settings.botChannels, channelId] });
        await ctx.reply({
          embeds: [successEmbed(ctx.t, ctx.t("settings.botChannelAdded", { channel: `<#${channelId}>` }))]
        });
        return;
      }
      case "remove": {
        const channelId = String(ctx.options.channel ?? ctx.args[0] ?? "").replace(/[<#>]/g, "");
        if (!settings.botChannels.includes(channelId)) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.botChannelNotSet"))] });
          return;
        }
        await updateGuildSettings(ctx.guild.id, {
          botChannels: settings.botChannels.filter((c) => c !== channelId)
        });
        await ctx.reply({
          embeds: [successEmbed(ctx.t, ctx.t("settings.botChannelRemoved", { channel: `<#${channelId}>` }))]
        });
        return;
      }
      case "clear":
      default: {
        await updateGuildSettings(ctx.guild.id, { botChannels: [] });
        await ctx.reply({ embeds: [successEmbed(ctx.t, ctx.t("settings.botChannelCleared"))] });
        return;
      }
    }
  }
};
var defaultVolumeCommand = {
  name: "defaultvolume",
  descriptionKey: "commands.defaultvolume.description",
  category: "settings",
  aliases: ["defvol"],
  permissions: { manageGuild: true },
  options: [
    { name: "level", descriptionKey: "commands.defaultvolume.options.level", type: "integer", required: true, min: 0, max: 150 }
  ],
  async execute(ctx) {
    const level = Number(ctx.options.level ?? ctx.args[0] ?? NaN);
    if (!Number.isFinite(level) || level < 0 || level > 150) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }
    await updateGuildSettings(ctx.guild.id, { defaultVolume: level });
    await ctx.reply({ embeds: [successEmbed(ctx.t, ctx.t("settings.defaultVolumeSet", { level }))] });
  }
};
var idleTimeoutCommand = {
  name: "idletimeout",
  descriptionKey: "commands.idletimeout.description",
  category: "settings",
  aliases: ["idle"],
  permissions: { manageGuild: true },
  options: [
    { name: "minutes", descriptionKey: "commands.idletimeout.options.minutes", type: "integer", required: true, min: 0, max: 120 }
  ],
  async execute(ctx) {
    const minutes = Number(ctx.options.minutes ?? ctx.args[0] ?? NaN);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 120) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }
    await updateGuildSettings(ctx.guild.id, { idleTimeout: minutes });
    if (minutes === 0) {
      await ctx.reply({ embeds: [successEmbed(ctx.t, ctx.t("settings.idleTimeoutDisabled"))] });
    } else {
      await ctx.reply({
        embeds: [successEmbed(ctx.t, ctx.t("settings.idleTimeoutSet", { minutes }))]
      });
    }
  }
};

// src/bot/commands/info/index.ts
import { ActionRowBuilder as ActionRowBuilder6, ButtonBuilder as ButtonBuilder6, ButtonStyle as ButtonStyle6 } from "discord.js";

// src/bot/lib/helpview.ts
import {
  ActionRowBuilder as ActionRowBuilder5,
  ButtonBuilder as ButtonBuilder5,
  ButtonStyle as ButtonStyle5,
  StringSelectMenuBuilder as StringSelectMenuBuilder4
} from "discord.js";

// src/lib/command-catalog.ts
var commandCatalog = [
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
  { name: "developer", category: "info", descriptionKey: "commands.developer.description", aliases: ["dev", "shm", "credits"], usage: "developer" }
];
var COMMAND_COUNT = commandCatalog.length;

// src/lib/invite.ts
var INVITE_PERMISSIONS = "281475013766144";
function inviteUrl(clientId) {
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=${INVITE_PERMISSIONS}`;
}

// src/bot/lib/helpview.ts
function inviteUrl2() {
  return inviteUrl(getEnv().DISCORD_CLIENT_ID);
}
var HELP_CATEGORIES = [
  { id: "music", emoji: "\u{1F3B5}", labelKey: "info.helpFields.music" },
  { id: "playlists", emoji: "\u{1F4C1}", labelKey: "info.helpFields.playlists" },
  { id: "filters", emoji: "\u{1F39B}\uFE0F", labelKey: "info.helpFields.filters" },
  { id: "settings", emoji: "\u2699\uFE0F", labelKey: "info.helpFields.settings" },
  { id: "info", emoji: "\u2139\uFE0F", labelKey: "info.helpFields.info" }
];
function categoryOf(id) {
  return HELP_CATEGORIES.find((c) => c.id === id) ?? HELP_CATEGORIES[0];
}
function helpSelectRow(t2) {
  const menu = new StringSelectMenuBuilder4().setCustomId("slux:help").setPlaceholder(t2("info.helpPickCategory")).setMinValues(1).setMaxValues(1).addOptions(
    HELP_CATEGORIES.map((category) => {
      const count = commandCatalog.filter((c) => c.category === category.id).length;
      return {
        label: t2(category.labelKey),
        value: category.id,
        description: t2("info.helpCategoryCount", { count }).slice(0, 100),
        emoji: category.emoji
      };
    })
  );
  return new ActionRowBuilder5().addComponents(menu);
}
function helpLinkRow(t2) {
  const row = new ActionRowBuilder5().addComponents(
    new ButtonBuilder5().setLabel(t2("info.inviteButton")).setEmoji("\u{1F916}").setStyle(ButtonStyle5.Link).setURL(inviteUrl2())
  );
  const dashboard = dashboardBase();
  if (dashboard) {
    row.addComponents(
      new ButtonBuilder5().setLabel(t2("info.dashboardButton")).setEmoji("\u{1F5A5}\uFE0F").setStyle(ButtonStyle5.Link).setURL(dashboard)
    );
  }
  return row;
}
function buildHelpOverview(t2, prefix) {
  const total = commandCatalog.length;
  const embed = baseEmbed().setAuthor({ name: `${EMOJI.music} Slux \u2014 ${t2("info.helpTitle")}` }).setDescription(t2("info.helpDescription", { prefix })).addFields(
    HELP_CATEGORIES.map((category) => {
      const commands = commandCatalog.filter((c) => c.category === category.id);
      const names = commands.slice(0, 6).map((c) => `\`${c.name}\``).join(" ");
      return {
        name: `${category.emoji} ${t2(category.labelKey)} \u2014 ${commands.length}`,
        value: `${names}${commands.length > 6 ? ` \u2026 ${t2("info.helpAndMore", { count: commands.length - 6 })}` : ""}`,
        inline: false
      };
    })
  ).setFooter({ text: `${EMOJI.music} Slux \u2022 ${total} ${t2("common.commands")}` });
  return {
    embeds: [embed],
    components: [helpSelectRow(t2), helpLinkRow(t2)]
  };
}
function helpCategoryEmbed(t2, commands, categoryId, prefix, page, totalPages) {
  const category = categoryOf(categoryId);
  const perPage = 8;
  const start = (page - 1) * perPage;
  const items = commands.slice(start, start + perPage);
  const embed = baseEmbed().setAuthor({ name: `${category.emoji} ${t2(category.labelKey)} \u2014 ${t2("info.helpCommandsTitle")}` }).setDescription(
    items.map((command) => {
      const aliases = command.aliases.length > 0 ? `
> ${EMOJI.pin} \`${prefix}${command.aliases.join(`\`, \`${prefix}`)}\`` : "";
      return `**/${command.name}** \u2014 ${t2(command.descriptionKey)}${aliases}`;
    }).join("\n\n").slice(0, 3900)
  ).setFooter({
    text: `${t2("common.page", { current: page, total: totalPages })} \u2022 ${commands.length} ${t2("common.commands")}`
  });
  return embed;
}
async function handleHelpSelect(interaction, pagination, t2, categoryRaw, prefix = "/") {
  const category = categoryOf(categoryRaw);
  const commands = commandCatalog.filter((c) => c.category === category.id);
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(commands.length / perPage));
  const id = pagination.create(totalPages, (page) => ({
    embeds: [helpCategoryEmbed(t2, commands, category.id, prefix, page, totalPages)],
    rows: [helpSelectRow(t2), helpLinkRow(t2)]
  }));
  const view = pagination.build(id, 1);
  await interaction.update(view).catch(() => {
  });
}
function buildMentionHelp(t2, prefix) {
  const dashboard = dashboardBase();
  const embed = baseEmbed().setAuthor({ name: `\u{1F44B} ${t2("common.mentionHelp.title")}` }).setDescription(t2("common.mentionHelp.description")).addFields(
    {
      name: `\u2328\uFE0F ${t2("common.mentionHelp.prefixField")}`,
      value: t2("common.mentionHelp.prefixValue", { prefix: `\`${prefix}\`` }),
      inline: true
    },
    {
      name: `\u2728 ${t2("common.mentionHelp.slashField")}`,
      value: t2("common.mentionHelp.slashValue"),
      inline: true
    },
    {
      name: `\u{1F525} ${t2("common.mentionHelp.popularField")}`,
      value: [
        `\u{1F3B5} \`/play\` \u2022 \`/search\` \u2022 \`/queue\``,
        `\u{1F3A7} \`/nowplaying\` \u2022 \`/lyrics\` \u2022 \`/grab\``,
        `\u{1F39B}\uFE0F \`/filters\` \u2022 \`/bassboost\` \u2022 \`/loop\``,
        `\u{1F4DC} \`/playlist\` \u2022 \`/favorites\` \u2022 \`/help\``
      ].join("\n"),
      inline: false
    },
    {
      name: `\u{1F4A1} ${t2("common.mentionHelp.tipField")}`,
      value: t2("common.mentionHelp.tipValue", { prefix: `\`${prefix}\`` }),
      inline: false
    }
  ).setFooter({ text: `Slux \u2022 ${commandCatalog.length} ${t2("common.commands")}` });
  const linkRow = new ActionRowBuilder5();
  if (dashboard) {
    linkRow.addComponents(
      new ButtonBuilder5().setLabel(t2("common.mentionHelp.commandsButton")).setEmoji("\u{1F4DC}").setStyle(ButtonStyle5.Link).setURL(`${dashboard}/commands`),
      new ButtonBuilder5().setLabel(t2("common.mentionHelp.dashboardButton")).setEmoji("\u{1F5A5}\uFE0F").setStyle(ButtonStyle5.Link).setURL(dashboard)
    );
  }
  linkRow.addComponents(
    new ButtonBuilder5().setLabel(t2("common.mentionHelp.inviteButton")).setEmoji("\u{1F916}").setStyle(ButtonStyle5.Link).setURL(inviteUrl2())
  );
  return { embeds: [embed], components: [linkRow] };
}

// src/bot/commands/info/index.ts
var helpCommand = {
  name: "help",
  descriptionKey: "commands.help.description",
  category: "info",
  aliases: ["h", "commands"],
  async execute(ctx) {
    const view = buildHelpOverview(ctx.t, ctx.prefix);
    await ctx.reply(view);
  }
};
var pingCommand = {
  name: "ping",
  descriptionKey: "commands.ping.description",
  category: "info",
  aliases: ["latency"],
  async execute(ctx) {
    await ctx.defer();
    const ws = Math.round(ctx.client.ws.ping);
    const node = ctx.client.shoukaku.getIdealNode();
    const sentAt = Date.now();
    await ctx.editReply({ content: "\u{1F3D3}" }).catch(() => {
    });
    const roundtrip = Date.now() - sentAt;
    const latency = Math.max(ws, roundtrip);
    const color = latency < 100 ? 2278750 : latency < 250 ? 16096779 : 15680580;
    const embed = baseEmbed(color).setAuthor({ name: `${EMOJI.rocket} ${ctx.t("info.pingTitle")}` }).setDescription(
      `${latency < 100 ? "\u{1F7E2}" : latency < 250 ? "\u{1F7E1}" : "\u{1F534}"} ${ctx.t("info.pingStatus")}`
    ).addFields(
      { name: `\u{1F4E1} ${ctx.t("info.pingWebsocket")}`, value: `\`${ws}ms\``, inline: true },
      { name: `\u{1F501} ${ctx.t("info.pingRoundtrip")}`, value: `\`${roundtrip}ms\``, inline: true },
      {
        name: `\u{1F39A}\uFE0F ${ctx.t("info.statsNodePenalties")}`,
        value: node ? `\`${node.penalties}\`` : "\u2014",
        inline: true
      }
    );
    await ctx.editReply({ embeds: [embed], content: "" });
  }
};
var statsCommand = {
  name: "stats",
  descriptionKey: "commands.stats.description",
  category: "info",
  aliases: [],
  async execute(ctx) {
    const stats2 = ctx.client.music.stats();
    let users = 0;
    for (const guild of ctx.client.guilds.cache.values()) {
      users += guild.memberCount ?? 0;
    }
    const memory = process.memoryUsage().heapUsed / 1024 / 1024;
    const embed = baseEmbed().setAuthor({
      name: `${EMOJI.music} ${ctx.t("info.statsTitle")}`,
      iconURL: ctx.client.user?.displayAvatarURL({ size: 64 })
    }).addFields(
      { name: `\u{1F5A5}\uFE0F ${ctx.t("info.statsServers")}`, value: `\`${formatNumber(ctx.client.guilds.cache.size)}\``, inline: true },
      { name: `\u{1F3A7} ${ctx.t("info.statsPlayers")}`, value: `\`${formatNumber(stats2.players)}\``, inline: true },
      { name: `\u{1F465} ${ctx.t("info.statsUsers")}`, value: `\`${formatNumber(users)}\``, inline: true },
      { name: `\u23F1\uFE0F ${ctx.t("info.statsUptime")}`, value: `\`${formatDurationLong(process.uptime() * 1e3)}\``, inline: true },
      { name: `\u{1F4BE} ${ctx.t("info.statsMemory")}`, value: `\`${memory.toFixed(1)} MB\``, inline: true },
      {
        name: `\u{1F39A}\uFE0F ${ctx.t("info.statsNode")}`,
        value: stats2.nodeStats ? `\`${stats2.nodeStats.players}\` / \`${stats2.nodeStats.playingPlayers}\` \u25B6\uFE0F` : "\u2014",
        inline: true
      }
    ).setFooter({ text: `Slux \u2022 ${ctx.client.user?.tag ?? ""}` });
    if (ctx.client.user) {
      embed.setThumbnail(ctx.client.user.displayAvatarURL({ size: 128 }));
    }
    await ctx.reply({ embeds: [embed] });
  }
};
var developerCommand = {
  name: "developer",
  descriptionKey: "commands.developer.description",
  category: "info",
  aliases: ["dev", "shm", "credits"],
  async execute(ctx) {
    const dashboard = dashboardBase();
    const embed = baseEmbed().setAuthor({ name: `\u{1F496} ${ctx.t("info.developerTitle")}` }).setDescription(ctx.t("info.developerDescription")).addFields(
      { name: "\u{1F468}\u200D\u{1F4BB} Developer", value: `**SHM** \u2014 ${ctx.t("info.developerRole")}`, inline: true },
      { name: "\u25B6\uFE0F YouTube", value: "[@Letzforge](https://youtube.com/@Letzforge)", inline: true },
      { name: "\u{1F4AC} Discord", value: "**shahrib** \u2022 [Support server](https://discord.gg/NC4YdDQj5u)", inline: true },
      {
        name: `\u2728 ${ctx.t("info.developerWorkTitle")}`,
        value: ctx.t("info.developerWork"),
        inline: false
      }
    ).setFooter({
      text: `${ctx.t("info.developerFooter")} \u2022 Slux`,
      iconURL: ctx.client.user?.displayAvatarURL({ size: 64 })
    });
    const row = new ActionRowBuilder6().addComponents(
      new ButtonBuilder6().setLabel("Subscribe on YouTube").setEmoji("\u25B6\uFE0F").setStyle(ButtonStyle6.Link).setURL("https://youtube.com/@Letzforge"),
      new ButtonBuilder6().setLabel("Join Discord").setEmoji("\u{1F4AC}").setStyle(ButtonStyle6.Link).setURL("https://discord.gg/NC4YdDQj5u")
    );
    if (dashboard) {
      row.addComponents(
        new ButtonBuilder6().setLabel(ctx.t("info.dashboardButton")).setEmoji("\u{1F5A5}\uFE0F").setStyle(ButtonStyle6.Link).setURL(dashboard)
      );
    }
    await ctx.reply({ embeds: [embed], components: [row] });
  }
};
var nodesCommand = {
  name: "nodes",
  descriptionKey: "commands.nodes.description",
  category: "info",
  aliases: ["node", "lavalink"],
  async execute(ctx) {
    const nodes = [...ctx.client.shoukaku.nodes.values()];
    if (nodes.length === 0) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.engineNotReady"))] });
      return;
    }
    const statusOf = (state) => {
      switch (state) {
        case 1:
          return `\u{1F7E2} ${ctx.t("info.nodeConnected")}`;
        case 0:
          return `\u{1F7E1} ${ctx.t("info.nodeConnecting")}`;
        case 2:
          return `\u{1F7E0} ${ctx.t("info.nodeDisconnecting")}`;
        default:
          return `\u{1F534} ${ctx.t("info.nodeDisconnected")}`;
      }
    };
    const fields = nodes.map((node) => {
      const stats2 = node.stats;
      const cpu = stats2 ? `${(stats2.cpu.systemLoad * 100).toFixed(1)}%` : "\u2014";
      const players = stats2 ? `${stats2.players} (${stats2.playingPlayers} \u25B6\uFE0F)` : "\u2014";
      return {
        name: `${statusOf(node.state).split(" ")[0]} ${node.name}`,
        value: `${statusOf(node.state).slice(statusOf(node.state).indexOf(" ") + 1)}
\u{1F39A}\uFE0F ${ctx.t("info.nodePenalties")}: \`${node.penalties}\`
\u{1F3A7} ${ctx.t("info.nodePlayers")}: \`${players}\`
\u{1F4BE} ${ctx.t("info.nodeCpu")}: \`${cpu}\``,
        inline: true
      };
    });
    const ideal = ctx.client.shoukaku.getIdealNode();
    const embed = baseEmbed().setAuthor({ name: `\u{1F39A}\uFE0F ${ctx.t("info.nodesTitle")}` }).setDescription(
      ideal ? ctx.t("info.nodesActive", { name: `**${ideal.name}**` }) : ctx.t("music.engineNotReady")
    ).addFields(fields).setFooter({ text: `Slux \u2022 ${nodes.length} node(s)` });
    await ctx.reply({ embeds: [embed] });
  }
};
var inviteCommand = {
  name: "invite",
  descriptionKey: "commands.invite.description",
  category: "info",
  aliases: ["add"],
  async execute(ctx) {
    const url = inviteUrl2();
    const embed = baseEmbed().setAuthor({ name: `${EMOJI.rocket} ${ctx.t("info.inviteTitle")}` }).setDescription(ctx.t("info.inviteDescription")).setURL(url);
    await ctx.reply({ embeds: [embed] });
  }
};
var aboutCommand = {
  name: "about",
  descriptionKey: "commands.about.description",
  category: "info",
  aliases: ["info", "botinfo"],
  async execute(ctx) {
    const embed = baseEmbed().setAuthor({
      name: `${EMOJI.music} ${ctx.t("info.aboutTitle")}`,
      iconURL: ctx.client.user?.displayAvatarURL({ size: 64 })
    }).setDescription(ctx.t("info.aboutDescription")).addFields(
      { name: `\u{1F3B5} ${ctx.t("info.aboutSources")}`, value: "\u{1F7E2} Spotify \u2022 \u{1F534} YouTube \u2022 \u{1F7E0} SoundCloud \u2022 \u{1F7E3} Deezer \u2022 \u{1F34E} Apple Music \u2022 \u{1F30A} Tidal", inline: false },
      { name: `\u{1F39B}\uFE0F ${ctx.t("info.helpFields.filters")}`, value: "\u{1F50A} Bassboost \u2022 \u{1F680} Nightcore \u2022 \u{1F334} Vaporwave \u2022 \u{1F300} 8D \u2022 \u{1F3A4} Karaoke \u2022 \u{1F39A}\uFE0F EQ", inline: false },
      { name: `\u2728 ${ctx.t("info.aboutFeatures")}`, value: "\u{1F4DD} Synced lyrics \u2022 \u{1F4DC} Queue controls \u2022 \u{1F5A5}\uFE0F Web dashboard \u2022 \u{1F310} 6 languages \u2022 \u267E\uFE0F 24/7 mode", inline: false }
    ).setFooter({ text: ctx.t("info.aboutFooter") });
    if (ctx.client.user) {
      embed.setThumbnail(ctx.client.user.displayAvatarURL({ size: 256 }));
    }
    await ctx.reply({ embeds: [embed] });
  }
};

// src/bot/commands/index.ts
var commandsRegistry = [
  // Music
  playCommand,
  playnextCommand,
  playtopCommand,
  playskipCommand,
  pauseCommand,
  resumeCommand,
  stopCommand,
  skipCommand,
  previousCommand,
  seekCommand,
  forwardCommand,
  rewindCommand,
  replayCommand,
  joinCommand,
  queueCommand,
  nowplayingCommand,
  removeCommand,
  clearCommand,
  moveCommand,
  shuffleCommand,
  skipToCommand,
  removeDuplicatesCommand,
  loopCommand,
  volumeCommand,
  searchCommand,
  grabCommand,
  lyricsCommand,
  autoplayCommand,
  stayCommand,
  djModeCommand,
  sleepCommand,
  // Playlists
  playlistCommand,
  favoritesCommand,
  // Filters
  bassboostCommand,
  nightcoreCommand,
  vaporwaveCommand,
  softCommand,
  eightDCommand,
  karaokeCommand,
  tremoloCommand,
  vibratoCommand,
  distortionCommand,
  lowpassCommand,
  speedCommand,
  pitchCommand,
  eqCommand,
  filtersCommand,
  filtersResetCommand,
  // Settings
  settingsCommand,
  prefixCommand,
  languageCommand,
  djRoleCommand,
  botChannelCommand,
  defaultVolumeCommand,
  idleTimeoutCommand,
  // Info
  helpCommand,
  pingCommand,
  statsCommand,
  inviteCommand,
  aboutCommand,
  nodesCommand,
  developerCommand
];

// src/db/models/Blacklist.ts
import mongoose4, { Schema as Schema3, model as model3 } from "mongoose";
var blacklistSchema = new Schema3(
  {
    type: { type: String, enum: ["user", "guild"], required: true },
    targetId: { type: String, required: true },
    reason: { type: String, default: "" }
  },
  { timestamps: true }
);
blacklistSchema.index({ type: 1, targetId: 1 }, { unique: true });
var BlacklistModel = mongoose4.models.Blacklist ?? model3("Blacklist", blacklistSchema);
async function isBlacklisted(type, targetId) {
  try {
    if (mongoose4.connection.readyState !== 1) return false;
    const entry = await Promise.race([
      BlacklistModel.findOne({ type, targetId }).lean(),
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("database timeout")), 3e3);
        timer.unref?.();
      })
    ]);
    return entry !== null;
  } catch {
    return false;
  }
}

// src/bot/bot.ts
var COOLDOWN_MS = 3e3;
var BotService = class {
  client;
  music;
  bus = new EventEmitter();
  commands = new Collection();
  startedAt = Date.now();
  isDJ = isDJ;
  canControl = canControl;
  npManager = new NowPlayingManager();
  pagination = new PaginationManager();
  cooldowns = /* @__PURE__ */ new Map();
  ready = false;
  searchSessions = /* @__PURE__ */ new Map();
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
      partials: [Partials.Channel]
    });
    const nodes = lavalinkNodeOptions();
    const shoukaku = new Shoukaku(new Connectors.DiscordJS(this.client), nodes, {
      resume: true,
      resumeTimeout: 30,
      resumeByLibrary: true,
      // ~50 minutes of retries: Lavalink may still be booting (first run
      // downloads LavaSrc/LavaSearch/LavaLyrics plugins) when the bot logs in.
      reconnectTries: 300,
      reconnectInterval: 1e4,
      restTimeout: 15e3,
      moveOnDisconnect: true,
      userAgent: "Slux/1.0 (https://slux.example)"
    });
    this.client.shoukaku = shoukaku;
    this.music = new MusicManager(this.client, {
      onSnapshot: (snapshot) => this.bus.emit("snapshot", snapshot),
      onTrackStart: (guildId, track) => this.bus.emit("trackStart", { guildId, track }),
      onDestroy: (guildId, reason) => this.bus.emit("playerDestroy", { guildId, reason })
    });
    this.client.music = this.music;
    shoukaku.on("ready", (name) => console.log(`[slux] Lavalink node "${name}" ready`));
    shoukaku.on(
      "error",
      (_name, error) => console.error("[slux] Lavalink error:", error?.message ?? String(error))
    );
    shoukaku.on(
      "reconnecting",
      (name, left) => console.warn(`[slux] Reconnecting to "${name}" (${left} tries left)`)
    );
    shoukaku.on(
      "disconnect",
      (name, count) => console.warn(`[slux] Disconnected from "${name}" (${count} reconnects)`)
    );
    this.bus.on("trackStart", ({ guildId }) => {
      void this.npManager.handleTrackStart(this, guildId);
    });
    this.bus.on("playerDestroy", ({ guildId }) => {
      void this.npManager.handlePlayerDestroy(guildId);
    });
    this.bus.on("snapshot", (snapshot) => {
      this.npManager.handleSnapshot(this, snapshot);
    });
    this.bus.on("trackStart", ({ guildId, track }) => {
      void this.music.setVoiceChannelStatus(
        guildId,
        `\u{1F3B5} ${track.title} \u2022 ${track.author}`.slice(0, 500)
      );
    });
    this.loadCommands();
    this.bindEvents();
  }
  loadCommands() {
    for (const command of commandsRegistry) {
      this.commands.set(command.name, command);
    }
    console.log(`[slux] Loaded ${this.commands.size} commands`);
  }
  async login() {
    const env2 = getEnv();
    await this.client.login(env2.DISCORD_TOKEN);
  }
  async shutdown() {
    for (const guildId of [...this.music.players.keys()]) {
      await this.music.destroyPlayer(guildId, "shutdown");
    }
    await this.client.destroy();
  }
  // ── Event wiring ─────────────────────────────────────────────────
  bindEvents() {
    this.client.once(Events.ClientReady, async (client) => {
      console.log(`[slux] Logged in as ${client.user.tag} (${client.guilds.cache.size} guilds)`);
      await this.registerSlashCommands();
      this.ready = true;
      this.bus.emit("ready");
    });
    this.client.on(Events.InteractionCreate, (interaction) => {
      this.handleInteraction(interaction).catch(
        (err) => this.logEventError("interactionCreate", err)
      );
    });
    this.client.on(Events.MessageCreate, (message) => {
      this.handleMessage(message).catch((err) => this.logEventError("messageCreate", err));
    });
    this.client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      this.handleVoiceStateUpdate(oldState, newState).catch(
        (err) => this.logEventError("voiceStateUpdate", err)
      );
    });
    this.client.on(Events.GuildCreate, (guild) => {
      this.handleGuildCreate(guild).catch((err) => this.logEventError("guildCreate", err));
    });
  }
  /** One-time thank-you message when the bot is added to a server. */
  async handleGuildCreate(guild) {
    if (!guild.available) return;
    if (Date.now() - (guild.joinedTimestamp ?? 0) > 10 * 6e4) return;
    try {
      const settings = await getGuildSettings(guild.id);
      if (settings.welcomed) return;
      const dashboard = dashboardBase();
      const fields = [
        { name: "\u2328\uFE0F Prefix", value: `\`${settings.prefix}\` \u2014 change it anytime with \`/prefix\``, inline: true },
        { name: "\u2728 Slash commands", value: "Type `/` and pick any command", inline: true }
      ];
      if (dashboard) {
        fields.push({
          name: "\u{1F5A5}\uFE0F Web dashboard",
          value: `[Open the dashboard](${dashboard}/dashboard) \u2014 control everything from your browser`,
          inline: false
        });
        fields.push({
          name: "\u{1F4DC} All commands",
          value: `[Browse the full command list](${dashboard}/commands)`,
          inline: false
        });
      }
      fields.push({
        name: "\u{1F4A1} Tip",
        value: "Mention me (`@Slux`) anytime to see this server's prefix and popular commands!",
        inline: false
      });
      const embed = baseEmbed().setAuthor({ name: "\u{1F389} Thanks for adding Slux!" }).setDescription(
        `Hey **${guild.name}** \u2014 I'm Slux, your new music bot! I'm online and ready to play.

To get started, type **\`/play\`** or **\`${settings.prefix}play <song>\`** while in a voice channel.`
      ).addFields(fields).setImage(
        "https://cdn.discordapp.com/attachments/922122006487515136/1547497081143562290/sluxwelcomemsg.png"
      ).setFooter({ text: "Made with \u2764\uFE0F by SHM \u2022 YouTube: @Letzforge \u2022 Discord: shahrib" });
      const row = new ActionRowBuilder7();
      if (dashboard) {
        row.addComponents(
          new ButtonBuilder7().setLabel("Open Dashboard").setEmoji("\u{1F5A5}\uFE0F").setStyle(ButtonStyle7.Link).setURL(dashboard),
          new ButtonBuilder7().setLabel("Commands").setEmoji("\u{1F4DC}").setStyle(ButtonStyle7.Link).setURL(`${dashboard}/commands`)
        );
      }
      row.addComponents(
        new ButtonBuilder7().setLabel("YouTube").setEmoji("\u25B6\uFE0F").setStyle(ButtonStyle7.Link).setURL("https://youtube.com/@Letzforge"),
        new ButtonBuilder7().setLabel("Support Server").setEmoji("\u{1F4AC}").setStyle(ButtonStyle7.Link).setURL("https://discord.gg/NC4YdDQj5u")
      );
      let target = guild.systemChannel;
      if (!target?.permissionsFor(guild.members.me ?? "")?.has(PermissionFlagsBits3.SendMessages)) {
        target = guild.channels.cache.find(
          (ch) => ch.isTextBased() && ch.permissionsFor(guild.members.me ?? "")?.has(PermissionFlagsBits3.SendMessages | PermissionFlagsBits3.ViewChannel) === true
        ) ?? null;
      }
      await target?.send({
        content: "Thanks for the invite!",
        embeds: [embed],
        components: [row]
      }).catch(() => null);
      await GuildModel.updateOne({ id: guild.id }, { $set: { welcomed: true } }).catch(() => null);
      invalidateGuildCache(guild.id);
      console.log(`[slux] Welcomed by guild ${guild.name} (${guild.id})`);
    } catch (err) {
      this.logEventError("guildCreate welcome", err);
    }
  }
  logEventError(event, err) {
    console.error(
      `[slux] ${event} handler error:`,
      err instanceof Error ? err.stack ?? err.message : err
    );
  }
  // ── Slash registration ───────────────────────────────────────────
  localizedDescriptions(descriptionKey) {
    const en = createTranslator("en")(descriptionKey);
    const out = {};
    for (const locale of LOCALES) {
      const text = createTranslator(locale.code)(descriptionKey);
      out[locale.discord] = text === descriptionKey ? en : text;
    }
    return out;
  }
  /** Discord API wants `description` as a plain string plus a separate
   *  `description_localizations` map — not an object in the description field. */
  localizedText(descriptionKey) {
    const localizations = this.localizedDescriptions(descriptionKey);
    for (const key of Object.keys(localizations)) {
      if (localizations[key].length > 100) localizations[key] = localizations[key].slice(0, 97) + "...";
    }
    return { description: localizations["en-US"] ?? descriptionKey, localizations };
  }
  buildOptionData(option) {
    const { description, localizations } = this.localizedText(option.descriptionKey);
    const base = {
      name: option.name,
      description,
      description_localizations: localizations,
      required: option.required ?? false
    };
    switch (option.type) {
      case "integer":
      case "number":
        return {
          ...base,
          type: option.type === "integer" ? ApplicationCommandOptionType.Integer : ApplicationCommandOptionType.Number,
          ...option.min !== void 0 ? { min_value: option.min } : {},
          ...option.max !== void 0 ? { max_value: option.max } : {}
        };
      case "boolean":
        return { ...base, type: ApplicationCommandOptionType.Boolean };
      case "role":
        return { ...base, type: ApplicationCommandOptionType.Role };
      case "channel":
        return { ...base, type: ApplicationCommandOptionType.Channel };
      case "user":
        return { ...base, type: ApplicationCommandOptionType.User };
      default:
        return {
          ...base,
          type: ApplicationCommandOptionType.String,
          ...option.choices ? { choices: option.choices.map((c) => ({ name: c.nameKey, value: c.value })) } : {}
        };
    }
  }
  buildCommandJson(command) {
    const { description, localizations } = this.localizedText(command.descriptionKey);
    const json = {
      name: command.name,
      description,
      description_localizations: localizations,
      dmPermission: false,
      type: ApplicationCommandType.ChatInput
    };
    if (command.subcommands && command.subcommands.length > 0) {
      json.options = command.subcommands.map((sub) => {
        const subText = this.localizedText(sub.descriptionKey);
        return {
          name: sub.name,
          description: subText.description,
          description_localizations: subText.localizations,
          type: ApplicationCommandOptionType.Subcommand,
          options: (sub.options ?? []).map((o) => this.buildOptionData(o))
        };
      });
    } else if (command.options && command.options.length > 0) {
      json.options = command.options.map((o) => this.buildOptionData(o));
    }
    return json;
  }
  async registerSlashCommands() {
    const body = [...this.commands.values()].map((c) => this.buildCommandJson(c));
    try {
      await this.client.application?.commands.set(body);
      console.log(`[slux] Registered ${body.length} slash commands`);
    } catch (err) {
      console.error("[slux] Failed to register slash commands:", err);
    }
  }
  // ── Interaction handling ─────────────────────────────────────────
  async handleInteraction(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await this.handleSelectMenu(interaction);
      }
    } catch (err) {
      console.error("[slux] Interaction error:", err);
      const payload = {
        embeds: [errorEmbed(createTranslator("en"), "Something went wrong.")],
        flags: MessageFlags2.Ephemeral
      };
      const repliable = interaction;
      if (repliable.isRepliable()) {
        if (repliable.deferred || repliable.replied) {
          await repliable.followUp(payload).catch(() => {
          });
        } else {
          await repliable.reply(payload).catch(() => {
          });
        }
      }
    }
  }
  async handleSlashCommand(interaction) {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;
    const autoDefer = setTimeout(() => {
      if (!interaction.deferred && !interaction.replied) {
        void interaction.deferReply().catch(() => {
        });
      }
    }, 2400);
    autoDefer.unref?.();
    try {
      await this.runSlashCommand(interaction, command);
    } finally {
      clearTimeout(autoDefer);
    }
  }
  async runSlashCommand(interaction, command) {
    const guild = interaction.guild;
    const settings = guild ? await getGuildSettings(guild.id) : null;
    const locale = normalizeLocale(settings?.language ?? "en");
    const t2 = createTranslator(locale);
    if (await isBlacklisted("user", interaction.user.id)) {
      await interaction.reply({ content: t2("common.blacklisted"), flags: MessageFlags2.Ephemeral });
      return;
    }
    if (guild && settings && !botChannelAllowed(guild, settings, interaction.channelId)) {
      await interaction.reply({ embeds: [errorEmbed(t2, t2("common.channelNotAllowed"))], flags: MessageFlags2.Ephemeral }).catch(() => {
      });
      return;
    }
    if (!this.checkCooldown(interaction.user.id, command.name)) {
      await interaction.reply({ embeds: [errorEmbed(t2, t2("common.cooldown"))], flags: MessageFlags2.Ephemeral }).catch(() => {
      });
      return;
    }
    const options = {};
    let subcommand;
    if (command.subcommands) {
      subcommand = interaction.options.getSubcommand(false) ?? void 0;
      const sub = command.subcommands.find((s) => s.name === subcommand);
      for (const opt of sub?.options ?? []) {
        const value = interaction.options.get(opt.name, false)?.value;
        if (value !== null && value !== void 0) options[opt.name] = value;
      }
    } else if (command.options) {
      for (const opt of command.options) {
        const value = interaction.options.get(opt.name, false)?.value;
        if (value !== null && value !== void 0) options[opt.name] = value;
      }
    }
    const ctx = await this.createContext({
      interaction,
      locale,
      t: t2,
      options,
      subcommand,
      prefix: settings?.prefix ?? "!",
      args: []
    });
    const failure = await this.checkPermissions(ctx, command, settings);
    if (failure) {
      if (command.name === "play" || command.name === "search") {
        console.warn(
          `[slux] /${command.name} permission rejection for ${interaction.user.tag}: ${failure}`
        );
      }
      await ctx.reply({ embeds: [errorEmbed(t2, failure)], flags: MessageFlags2.Ephemeral });
      return;
    }
    let ctxReplied = false;
    const originalReply = ctx.reply;
    ctx.reply = async (replyOptions) => {
      ctxReplied = true;
      return originalReply(replyOptions);
    };
    const startedAt = Date.now();
    const watchdog = setTimeout(() => {
      if (ctxReplied || interaction.replied) return;
      console.error(
        `[slux] /${command.name} stalled for ${Date.now() - startedAt}ms without a reply \u2014 forcing an error reply`
      );
      void interaction.followUp({ embeds: [errorEmbed(t2, t2("common.error"))] }).catch(() => {
      });
    }, 3e4);
    watchdog.unref?.();
    try {
      await command.execute(ctx);
    } catch (err) {
      console.error(`[slux] Command "${command.name}" failed:`, err);
      await ctx.reply({ embeds: [errorEmbed(t2, t2("common.error"))] }).catch(() => {
      });
    } finally {
      clearTimeout(watchdog);
    }
  }
  // ── Prefix message handling ──────────────────────────────────────
  async handleMessage(message) {
    if (message.author.bot || !message.guild || !this.ready) return;
    const settings = await getGuildSettings(message.guild.id);
    const prefix = settings.prefix;
    const mention = `<@${this.client.user?.id}>`;
    const mentionOnly = new RegExp(`^<@!?${this.client.user?.id}>\\s*$`);
    if (mentionOnly.test(message.content.trim())) {
      const t3 = createTranslator(normalizeLocale(settings.language));
      await message.reply(buildMentionHelp(t3, prefix)).catch(() => {
      });
      return;
    }
    let usedPrefix = "";
    if (message.content.startsWith(prefix)) {
      usedPrefix = prefix;
    } else if (message.content.startsWith(mention)) {
      usedPrefix = mention;
    } else {
      return;
    }
    const body = message.content.slice(usedPrefix.length).trim();
    if (!body) return;
    const tokens = tokenize(body);
    const name = tokens[0].toLowerCase();
    const args = tokens.slice(1);
    const command = this.commands.get(name) ?? this.commands.find((c) => c.aliases.includes(name));
    if (!command) return;
    const locale = normalizeLocale(settings.language);
    const t2 = createTranslator(locale);
    if (await isBlacklisted("user", message.author.id)) {
      await message.reply({ content: t2("common.blacklisted") });
      return;
    }
    if (!botChannelAllowed(message.guild, settings, message.channelId)) return;
    if (!this.checkCooldown(message.author.id, command.name)) return;
    let options = {};
    let subcommand;
    let remaining = [...args];
    if (command.subcommands) {
      subcommand = remaining[0]?.toLowerCase();
      const sub = command.subcommands.find((s) => s.name === subcommand);
      if (!sub) {
        await message.reply({
          embeds: [
            errorEmbed(
              t2,
              `playlist \u2192 ${command.subcommands.map((s) => `\`${s.name}\``).join(" ")}`
            )
          ]
        });
        return;
      }
      remaining = remaining.slice(1);
      ({ options, remaining } = this.parseOptions(sub.options ?? [], remaining));
    } else if (command.options) {
      ({ options, remaining } = this.parseOptions(command.options, remaining));
    }
    const ctx = await this.createContext({
      message,
      locale,
      t: t2,
      options,
      subcommand,
      prefix: usedPrefix === mention ? `${mention} ` : usedPrefix,
      args: remaining
    });
    const failure = await this.checkPermissions(ctx, command, settings);
    if (failure) {
      await ctx.reply({ embeds: [errorEmbed(t2, failure)] });
      return;
    }
    try {
      await command.execute(ctx);
    } catch (err) {
      console.error(`[slux] Command "${command.name}" failed:`, err);
      await ctx.reply({ embeds: [errorEmbed(t2, t2("common.error"))] }).catch(() => {
      });
    }
  }
  parseOptions(specs, args) {
    const options = {};
    const remaining = [...args];
    for (const spec of specs) {
      if (spec.rest && spec.type === "string") {
        if (remaining.length > 0) {
          options[spec.name] = remaining.join(" ");
          remaining.length = 0;
        }
        continue;
      }
      const token = remaining.shift();
      if (token === void 0) continue;
      if (spec.type === "integer" || spec.type === "number") {
        const num = spec.type === "integer" ? parseInt(token, 10) : parseFloat(token);
        if (Number.isFinite(num)) {
          if (spec.min !== void 0 && num < spec.min) continue;
          if (spec.max !== void 0 && num > spec.max) continue;
          options[spec.name] = num;
        }
      } else if (spec.type === "boolean") {
        options[spec.name] = token === "true" || token === "yes" || token === "on";
      } else {
        options[spec.name] = token;
      }
    }
    return { options, remaining };
  }
  async createContext(input) {
    const { interaction, message, locale, t: t2, options, subcommand, prefix, args } = input;
    const author = interaction?.user ?? message.author;
    const guild = interaction?.guild ?? message.guild ?? null;
    const channel = interaction?.channel ?? message.channel ?? null;
    const rawMember = interaction?.member ?? message?.member ?? null;
    let member = rawMember && "permissions" in rawMember && typeof rawMember.permissions !== "undefined" ? rawMember : null;
    if (interaction?.guild && (!member || !member.voice?.channelId)) {
      const fetched = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (fetched) member = fetched;
    }
    let lastReply = null;
    return {
      client: this.client,
      guild,
      channel,
      author,
      member,
      locale,
      t: t2,
      options,
      subcommand,
      prefix,
      args,
      interaction,
      message,
      pagination: this.pagination,
      searchSessions: this.searchSessions,
      reply: async (replyOptions) => {
        if (interaction) {
          if (interaction.deferred && !interaction.replied) {
            const payload = { ...replyOptions };
            delete payload.flags;
            return await interaction.editReply(payload).catch((err) => {
              console.error("[slux] editReply failed:", err);
              return null;
            });
          }
          if (interaction.deferred || interaction.replied) {
            return await interaction.followUp(replyOptions).catch((err) => {
              console.error("[slux] followUp failed:", err);
              return null;
            });
          }
          return await interaction.reply({ ...replyOptions, fetchReply: true }).catch(async (err) => {
            if (interaction.deferred && !interaction.replied) {
              const payload = { ...replyOptions };
              delete payload.flags;
              return interaction.editReply(payload).catch(() => null);
            }
            console.error("[slux] interaction reply failed:", err);
            return null;
          });
        }
        return message.reply(replyOptions).catch(() => null);
      },
      editReply: async (replyOptions) => {
        if (interaction) {
          return await interaction.editReply(replyOptions).catch(() => null);
        }
        if (lastReply) {
          return await lastReply.edit(replyOptions).catch(() => null);
        }
        lastReply = await message.reply(replyOptions).catch(() => null);
        return lastReply;
      },
      defer: async (ephemeral = false) => {
        if (interaction && !interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ flags: ephemeral ? MessageFlags2.Ephemeral : void 0 }).catch(() => {
          });
        }
      }
    };
  }
  checkCooldown(userId, commandName) {
    const key = `${userId}:${commandName}`;
    const now = Date.now();
    const last = this.cooldowns.get(key) ?? 0;
    if (now - last < COOLDOWN_MS) return false;
    this.cooldowns.set(key, now);
    return true;
  }
  async checkPermissions(ctx, command, settings) {
    const perms = command.permissions;
    if (!perms) return null;
    const t2 = ctx.t;
    if (perms.manageGuild && !manageGuild(ctx.member)) {
      return t2("common.manageGuildRequired");
    }
    if ((perms.voice || perms.sameVoice) && !ctx.member?.voice.channel) {
      return t2("common.noVoiceChannel");
    }
    const player = ctx.guild ? this.music.getPlayer(ctx.guild.id) : void 0;
    if (perms.player && !player) return t2("common.noPlayer");
    if (perms.sameVoice && player) {
      const botVoice = player.voiceChannel;
      if (botVoice && ctx.member?.voice.channelId && ctx.member.voice.channelId !== botVoice.id) {
        return t2("common.notInSameVoice");
      }
    }
    if (perms.dj && settings && !isDJ(ctx.member, settings, player)) {
      return t2("common.djRequired");
    }
    if (player && settings && !canControl(ctx.member, settings, player)) {
      return t2("music.djmodeActive");
    }
    return null;
  }
  // ── Buttons ──────────────────────────────────────────────────────
  async handleButton(interaction) {
    const [ns, kind, ...rest] = interaction.customId.split(":");
    if (ns !== "slux") return;
    const guild = interaction.guild;
    if (!guild) return;
    const settings = await getGuildSettings(guild.id);
    const locale = normalizeLocale(settings.language);
    const t2 = createTranslator(locale);
    if (kind === "pg") {
      await this.pagination.handle(interaction, rest[0] ?? "", rest[1] ?? "", t2);
      return;
    }
    const player = this.music.getPlayer(guild.id);
    if (!player) {
      await interaction.reply({ embeds: [errorEmbed(t2, t2("common.noPlayer"))], flags: MessageFlags2.Ephemeral }).catch(() => {
      });
      return;
    }
    switch (kind) {
      case "ctrl": {
        await handleControllerButton(interaction, this, player, t2, settings);
        return;
      }
      case "q": {
        const page = Math.max(1, parseInt(rest[0] ?? "1", 10) || 1);
        const { embed, components } = await buildQueueMessage(
          player,
          guild.name,
          page,
          t2,
          guild.iconURL() ?? void 0
        );
        await interaction.update({ embeds: [embed], components }).catch(() => {
        });
        return;
      }
      case "sel": {
        await handleSearchSelect(interaction, this, player, t2, settings, rest);
        return;
      }
      case "loop": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction.reply({ embeds: [errorEmbed(t2, t2("music.djmodeActive"))], flags: MessageFlags2.Ephemeral }).catch(() => {
          });
          return;
        }
        await handleLoopButton(interaction, player, t2, rest[0] ?? "");
        return;
      }
      case "vol": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction.reply({ embeds: [errorEmbed(t2, t2("music.djmodeActive"))], flags: MessageFlags2.Ephemeral }).catch(() => {
          });
          return;
        }
        await handleVolumeButton(interaction, player, t2, rest[0] ?? "0");
        return;
      }
      case "tgl": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction.reply({ embeds: [errorEmbed(t2, t2("music.djmodeActive"))], flags: MessageFlags2.Ephemeral }).catch(() => {
          });
          return;
        }
        await handleToggleButton(interaction, player, t2, rest[0] ?? "");
        return;
      }
      case "fxopen": {
        await interaction.update(buildFiltersPanel(player, t2)).catch(() => {
        });
        return;
      }
      case "fxreset": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction.reply({ embeds: [errorEmbed(t2, t2("music.djmodeActive"))], flags: MessageFlags2.Ephemeral }).catch(() => {
          });
          return;
        }
        await handleFilterReset(interaction, player, t2);
        return;
      }
    }
  }
  // ── Select menus ────────────────────────────────────────────────
  async handleSelectMenu(interaction) {
    const [ns, kind, ...rest] = interaction.customId.split(":");
    if (ns !== "slux") return;
    const guild = interaction.guild;
    if (!guild) return;
    const settings = await getGuildSettings(guild.id);
    const locale = normalizeLocale(settings.language);
    const t2 = createTranslator(locale);
    const value = interaction.values[0];
    if (kind === "help") {
      const prefix = settings.prefix ?? "!";
      await handleHelpSelect(interaction, this.pagination, t2, value, prefix);
      return;
    }
    const player = this.music.getPlayer(guild.id);
    if (!player) {
      await interaction.reply({ embeds: [errorEmbed(t2, t2("common.noPlayer"))], flags: MessageFlags2.Ephemeral }).catch(() => {
      });
      return;
    }
    switch (kind) {
      case "sel": {
        await handleSearchSelect(interaction, this, player, t2, settings, rest, value);
        return;
      }
      case "fx": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction.reply({ embeds: [errorEmbed(t2, t2("music.djmodeActive"))], flags: MessageFlags2.Ephemeral }).catch(() => {
          });
          return;
        }
        await handleFilterSelect(interaction, player, t2, value ?? "");
        return;
      }
      case "qsel": {
        const page = Math.max(1, parseInt(value ?? "1", 10) || 1);
        const { embed, components } = await buildQueueMessage(
          player,
          guild.name,
          page,
          t2,
          guild.iconURL() ?? void 0
        );
        await interaction.update({ embeds: [embed], components }).catch(() => {
        });
        return;
      }
    }
  }
  // ── Voice state handling ─────────────────────────────────────────
  async handleVoiceStateUpdate(oldState, newState) {
    const guildId = oldState.guild.id;
    const player = this.music.getPlayer(guildId);
    if (!player) return;
    if (oldState.id === this.client.user?.id) {
      if (!newState.channelId) {
        await this.music.destroyPlayer(guildId, "disconnected");
        return;
      }
      return;
    }
    if (!newState.channelId || newState.channelId !== player.voiceChannel?.id) {
      const channel = player.voiceChannel;
      if (!channel) return;
      const humans = channel.members.filter((m) => !m.user.bot);
      if (humans.size === 0 && !player.stayInChannel) {
        if (player.current) await player.pause();
        setTimeout(() => {
          const p = this.music.getPlayer(guildId);
          if (!p) return;
          const ch = p.voiceChannel;
          if (ch && ch.members.filter((m) => !m.user.bot).size === 0 && !p.stayInChannel) {
            void p.leaveDueTo("alone");
          }
        }, 6e4).unref?.();
      }
    }
  }
  invalidateGuild(guildId) {
    invalidateGuildCache(guildId);
    void this.music.getPlayer(guildId)?.refreshLocale();
  }
  get uptimeSeconds() {
    return Math.floor((Date.now() - this.startedAt) / 1e3);
  }
};

// src/lib/bot-singleton.ts
function getBot() {
  return globalThis.__slux_bot ?? null;
}
function setBot(bot) {
  globalThis.__slux_bot = bot;
}

// src/db/connect.ts
import mongoose5 from "mongoose";
async function connectDatabase() {
  if (globalThis.__slux_mongo) return globalThis.__slux_mongo;
  const env2 = getEnv();
  mongoose5.set("strictQuery", true);
  const conn = await mongoose5.connect(env2.MONGODB_URI, {
    dbName: "slux",
    // Fail fast instead of buffering queries forever while disconnected —
    // hot paths (guild settings, blacklist) fall back to defaults.
    bufferCommands: false
  });
  globalThis.__slux_mongo = conn;
  return conn;
}
async function disconnectDatabase() {
  if (globalThis.__slux_mongo) {
    await globalThis.__slux_mongo.disconnect();
    globalThis.__slux_mongo = void 0;
  }
}

// src/lib/jwt.ts
import { SignJWT, jwtVerify } from "jose";
var SESSION_COOKIE = "slux_session";
var STATE_COOKIE = "slux_oauth_state";
var SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
function secret() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}
async function signSessionToken(payload) {
  return new SignJWT({ ...payload }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_TTL_SECONDS}s`).sign(secret());
}
async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, secret());
  return payload;
}
function discordOAuthUrl(state) {
  const env2 = getEnv();
  const params = new URLSearchParams({
    client_id: env2.DISCORD_CLIENT_ID,
    redirect_uri: `${env2.APP_URL}/api/auth/callback`,
    response_type: "code",
    scope: "identify email guilds",
    state,
    prompt: "none"
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}
function oauthStateSecret() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// src/bot/music/types.ts
function emptyPlayerSnapshot(guildId, guildName = "") {
  return {
    guildId,
    guildName,
    connected: false,
    channelId: null,
    channelName: null,
    playing: false,
    paused: false,
    position: 0,
    updatedAt: Date.now(),
    track: null,
    queue: [],
    history: [],
    repeat: "off",
    shuffle: false,
    autoplay: false,
    stayInChannel: false,
    volume: 100,
    filters: [],
    djMode: false
  };
}

// src/server/api.ts
import { z as z2 } from "zod";
function sendJson(res, status, data, headers) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}
function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}
function readBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function parseCookies(req) {
  const header = req.headers.cookie ?? "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}
function sessionCookie(env2, name, value, maxAge) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${maxAge}`,
    "SameSite=Lax"
  ];
  if (env2.NODE_ENV === "production") {
    attrs.push("Secure");
  }
  return attrs.join("; ");
}
async function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
async function requireSession(req, res) {
  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }
  return session;
}
function allowedOrigins(env2) {
  const origins = /* @__PURE__ */ new Set();
  if (env2.DASHBOARD_URL) origins.add(env2.DASHBOARD_URL);
  if (env2.APP_URL) origins.add(env2.APP_URL);
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  return [...origins];
}
function corsHeaders(req, env2) {
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins(env2).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
async function fetchUserGuilds(session) {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${session.accessToken}` }
  }).catch(() => null);
  if (!res?.ok) return null;
  const guilds2 = await res.json().catch(() => null);
  return Array.isArray(guilds2) ? guilds2 : null;
}
async function userManagesGuild(session, guildId) {
  const guilds2 = await fetchUserGuilds(session);
  const guild = guilds2?.find((g) => g.id === guildId);
  if (!guild) return false;
  return guild.owner || (BigInt(guild.permissions) & 0x20n) === 0x20n;
}
var authLogin = async (req, res) => {
  const env2 = getEnv();
  const state = oauthStateSecret();
  res.setHeader(
    "Set-Cookie",
    sessionCookie(env2, STATE_COOKIE, state, 600)
  );
  redirect(res, discordOAuthUrl(state));
};
var authCallback = async (req, res, _params, query) => {
  const env2 = getEnv();
  const code = query.get("code");
  const state = query.get("state");
  const cookies = parseCookies(req);
  const expected = cookies[STATE_COOKIE];
  const frontendBase = env2.DASHBOARD_URL ?? env2.APP_URL;
  if (!code || !state || !expected || state !== expected) {
    redirect(res, `${frontendBase}/?auth=failed`);
    return;
  }
  res.setHeader("Set-Cookie", sessionCookie(env2, STATE_COOKIE, "", 0));
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env2.DISCORD_CLIENT_ID,
        client_secret: env2.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${env2.APP_URL}/api/auth/callback`
      })
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed (${tokenRes.status})`);
    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userRes.ok) throw new Error(`user fetch failed (${userRes.status})`);
    const user = await userRes.json();
    const jwt = await signSessionToken({
      userId: user.id,
      username: user.username,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : "",
      accessToken: tokenData.access_token
    });
    res.setHeader("Set-Cookie", sessionCookie(env2, SESSION_COOKIE, jwt, 60 * 60 * 24 * 7));
    redirect(res, `${frontendBase}/dashboard`);
  } catch (err) {
    console.error("[slux] OAuth callback error:", err);
    redirect(res, `${frontendBase}/?auth=failed`);
  }
};
var authLogout = async (req, res) => {
  const env2 = getEnv();
  res.setHeader("Set-Cookie", sessionCookie(env2, SESSION_COOKIE, "", 0));
  sendJson(res, 200, { ok: true });
};
var authMe = async (req, res) => {
  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { authenticated: false });
    return;
  }
  sendJson(res, 200, {
    authenticated: true,
    user: { id: session.userId, username: session.username, avatar: session.avatar }
  });
};
var stats = async (req, res) => {
  const bot = getBot();
  let servers = 0;
  let players = 0;
  let users = 0;
  if (bot) {
    servers = bot.client.guilds.cache.size;
    players = bot.music.stats().players;
    for (const guild of bot.client.guilds.cache.values()) {
      users += guild.memberCount ?? 0;
    }
  }
  sendJson(res, 200, {
    servers,
    players,
    users,
    commands: COMMAND_COUNT,
    uptime: bot?.uptimeSeconds ?? 0
  });
};
var guilds = async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const list = await fetchUserGuilds(session);
  if (list === null) {
    sendJson(res, 401, { error: "discord_unauthorized" });
    return;
  }
  const bot = getBot();
  const manageable = list.filter((g) => g.owner || (BigInt(g.permissions) & 0x20n) === 0x20n).map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
    memberCount: bot?.client.guilds.cache.get(g.id)?.memberCount ?? g.approximate_member_count ?? null,
    botPresent: !!bot?.client.guilds.cache.has(g.id)
  })).sort((a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name));
  sendJson(res, 200, { guilds: manageable, inviteUrl: inviteUrl(getEnv().DISCORD_CLIENT_ID) });
};
var settingsPatchSchema = z2.object({
  prefix: z2.string().min(1).max(5).regex(/^\S+$/).optional(),
  language: z2.enum(["en", "hi", "es", "fr", "de", "pt"]).optional(),
  djRoles: z2.array(z2.string().regex(/^\d{17,20}$/)).max(10).optional(),
  botChannels: z2.array(z2.string().regex(/^\d{17,20}$/)).max(20).optional(),
  defaultVolume: z2.number().int().min(0).max(150).optional(),
  defaultAutoplay: z2.boolean().optional(),
  default247: z2.boolean().optional(),
  idleTimeout: z2.number().int().min(0).max(120).optional()
});
var guildSettingsGet = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const guildId = params.guildId;
  const bot = getBot();
  const guild = bot?.client.guilds.cache.get(guildId);
  if (!bot || !guild) {
    sendJson(res, 404, { error: "bot not in guild" });
    return;
  }
  if (!await userManagesGuild(session, guildId)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  const settings = await getGuildSettings(guildId);
  sendJson(res, 200, {
    settings,
    guild: {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 }),
      roles: guild.roles.cache.filter((r) => !r.managed && r.id !== guild.id).sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, name: r.name, color: r.hexColor })).slice(0, 50),
      textChannels: guild.channels.cache.filter((c) => c.type === 0 || c.type === 5).sort((a, b) => a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name })),
      voiceChannels: guild.channels.cache.filter((c) => c.isVoiceBased()).sort((a, b) => a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name }))
    }
  });
};
var guildSettingsPatch = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const guildId = params.guildId;
  const bot = getBot();
  if (!bot?.client.guilds.cache.has(guildId)) {
    sendJson(res, 404, { error: "bot not in guild" });
    return;
  }
  if (!await userManagesGuild(session, guildId)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  const body = await readBody(req).catch(() => null);
  const parsed = settingsPatchSchema.safeParse(body ? JSON.parse(body) : null);
  if (!parsed.success) {
    sendJson(res, 400, { error: "invalid payload", issues: parsed.error.issues });
    return;
  }
  const settings = await updateGuildSettings(guildId, parsed.data);
  bot.invalidateGuild(guildId);
  sendJson(res, 200, { settings, languages: LOCALES.map((l) => l.code) });
};
var playerState = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const guildId = params.guildId;
  const bot = getBot();
  if (!bot) {
    sendJson(res, 503, { error: "bot unavailable" });
    return;
  }
  const guild = bot.client.guilds.cache.get(guildId);
  if (!guild) {
    sendJson(res, 404, { error: "bot not in guild" });
    return;
  }
  const player = bot.music.getPlayer(guildId);
  const voiceChannels = guild.channels.cache.filter((c) => c.isVoiceBased()).sort((a, b) => a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name }));
  const settings = await getGuildSettings(guildId);
  sendJson(res, 200, {
    snapshot: player?.snapshot() ?? null,
    voiceChannels,
    guild: { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 128 }) },
    settings: { language: settings.language, defaultVolume: settings.defaultVolume }
  });
};
var lyrics = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const guildId = params.guildId;
  const bot = getBot();
  if (!bot) {
    sendJson(res, 503, { error: "bot unavailable" });
    return;
  }
  const player = bot.music.getPlayer(guildId);
  const current = player?.current ?? null;
  if (!current) {
    sendJson(res, 200, { lyrics: null });
    return;
  }
  const result = await bot.music.lyricsForTrack(guildId, {
    title: current.title,
    author: current.author
  });
  sendJson(res, 200, { lyrics: result });
};
var search = async (req, res, _params, query) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const q = query.get("q");
  if (!q || q.trim().length < 2) {
    sendJson(res, 200, { results: [] });
    return;
  }
  const bot = getBot();
  if (!bot) {
    sendJson(res, 503, { error: "bot unavailable" });
    return;
  }
  const results = await bot.music.search(q, 10);
  sendJson(res, 200, { results });
};
var playlistsCreateSchema = z2.object({
  name: z2.string().min(1).max(64),
  description: z2.string().max(256).optional().default("")
});
var playlistsList = async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const playlists = await PlaylistModel.find({ ownerId: session.userId }).select("name description tracks public createdAt updatedAt").lean();
  sendJson(res, 200, {
    playlists: playlists.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      trackCount: p.tracks?.length ?? 0,
      public: p.public,
      tracks: (p.tracks ?? []).slice(0, 500),
      updatedAt: p.updatedAt
    }))
  });
};
var playlistsCreate = async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const body = await readBody(req).catch(() => null);
  const parsed = playlistsCreateSchema.safeParse(body ? JSON.parse(body) : null);
  if (!parsed.success) {
    sendJson(res, 400, { error: "invalid payload" });
    return;
  }
  const { name, description } = parsed.data;
  const exists = await PlaylistModel.findOne({ ownerId: session.userId, name });
  if (exists) {
    sendJson(res, 409, { error: "playlist exists" });
    return;
  }
  const playlist = await PlaylistModel.create({ ownerId: session.userId, name, description, tracks: [] });
  sendJson(res, 200, {
    playlist: {
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      trackCount: 0,
      public: playlist.public,
      tracks: []
    }
  });
};
var playlistPatchSchema = z2.object({
  name: z2.string().min(1).max(64).optional(),
  description: z2.string().max(256).optional(),
  public: z2.boolean().optional(),
  addTrack: z2.object({
    encoded: z2.string(),
    title: z2.string(),
    author: z2.string(),
    length: z2.number(),
    uri: z2.string().optional().default(""),
    artwork: z2.string().optional().default(""),
    sourceName: z2.string().optional().default("unknown"),
    identifier: z2.string().optional().default(""),
    isrc: z2.string().optional().default(""),
    isStream: z2.boolean().optional().default(false)
  }).optional(),
  removeTrackIndex: z2.number().int().min(1).optional()
});
async function findPlaylist(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  return PlaylistModel.findById(id);
}
var playlistGet = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const playlist = await findPlaylist(params.id);
  if (!playlist) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (!playlist.public && playlist.ownerId !== session.userId) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  sendJson(res, 200, {
    playlist: {
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      public: playlist.public,
      tracks: playlist.tracks,
      ownerId: playlist.ownerId
    }
  });
};
var playlistPatch = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const playlist = await findPlaylist(params.id);
  if (!playlist) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (playlist.ownerId !== session.userId) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  const body = await readBody(req).catch(() => null);
  const parsed = playlistPatchSchema.safeParse(body ? JSON.parse(body) : null);
  if (!parsed.success) {
    sendJson(res, 400, { error: "invalid payload" });
    return;
  }
  const { name, description, public: isPublic, addTrack, removeTrackIndex } = parsed.data;
  if (name !== void 0) {
    const clash = await PlaylistModel.findOne({
      ownerId: session.userId,
      name,
      _id: { $ne: playlist._id }
    });
    if (clash) {
      sendJson(res, 409, { error: "playlist exists" });
      return;
    }
    playlist.name = name;
  }
  if (description !== void 0) playlist.description = description;
  if (isPublic !== void 0) playlist.public = isPublic;
  if (addTrack) {
    if (playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
      sendJson(res, 400, { error: "playlist full" });
      return;
    }
    playlist.tracks.push({ ...addTrack });
  }
  if (removeTrackIndex !== void 0) {
    if (removeTrackIndex < 1 || removeTrackIndex > playlist.tracks.length) {
      sendJson(res, 400, { error: "bad index" });
      return;
    }
    playlist.tracks.splice(removeTrackIndex - 1, 1);
  }
  await playlist.save();
  sendJson(res, 200, {
    playlist: {
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      public: playlist.public,
      tracks: playlist.tracks,
      ownerId: playlist.ownerId
    }
  });
};
var playlistDelete = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const playlist = await findPlaylist(params.id);
  if (!playlist) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (playlist.ownerId !== session.userId) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  await PlaylistModel.deleteOne({ _id: playlist._id });
  sendJson(res, 200, { ok: true });
};
var routes = [
  { method: "GET", pattern: /^\/api\/auth\/login$/, keys: [], handler: authLogin },
  { method: "GET", pattern: /^\/api\/auth\/callback$/, keys: [], handler: authCallback },
  { method: "POST", pattern: /^\/api\/auth\/logout$/, keys: [], handler: authLogout },
  { method: "GET", pattern: /^\/api\/auth\/me$/, keys: [], handler: authMe },
  { method: "GET", pattern: /^\/api\/stats$/, keys: [], handler: stats },
  { method: "GET", pattern: /^\/api\/guilds$/, keys: [], handler: guilds },
  {
    method: "GET",
    pattern: /^\/api\/guilds\/(\d{17,20})\/settings$/,
    keys: ["guildId"],
    handler: guildSettingsGet
  },
  {
    method: "PATCH",
    pattern: /^\/api\/guilds\/(\d{17,20})\/settings$/,
    keys: ["guildId"],
    handler: guildSettingsPatch
  },
  { method: "GET", pattern: /^\/api\/player\/(\d{17,20})$/, keys: ["guildId"], handler: playerState },
  { method: "GET", pattern: /^\/api\/lyrics\/(\d{17,20})$/, keys: ["guildId"], handler: lyrics },
  { method: "GET", pattern: /^\/api\/search$/, keys: [], handler: search },
  { method: "GET", pattern: /^\/api\/playlists$/, keys: [], handler: playlistsList },
  { method: "POST", pattern: /^\/api\/playlists$/, keys: [], handler: playlistsCreate },
  { method: "GET", pattern: /^\/api\/playlists\/([a-f\d]{24})$/i, keys: ["id"], handler: playlistGet },
  { method: "PATCH", pattern: /^\/api\/playlists\/([a-f\d]{24})$/i, keys: ["id"], handler: playlistPatch },
  { method: "DELETE", pattern: /^\/api\/playlists\/([a-f\d]{24})$/i, keys: ["id"], handler: playlistDelete }
];
function createApiHandler() {
  return async (req, res) => {
    const env2 = getEnv();
    const cors = corsHeaders(req, env2);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = ((status, ...rest) => {
      const explicit = rest.find((a) => a !== null && typeof a === "object");
      const merged = { ...cors, ...explicit ?? {} };
      if (Object.keys(merged).length === 0) return originalWriteHead(status);
      return originalWriteHead(status, merged);
    });
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const path = url.pathname;
      const query = url.searchParams;
      for (const route of routes) {
        if (route.method !== req.method) continue;
        const match = route.pattern.exec(path);
        if (!match) continue;
        const params = {};
        route.keys.forEach((key, i) => {
          params[key] = match[i + 1];
        });
        await route.handler(req, res, params, query);
        return;
      }
      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      console.error("[slux] API error:", err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "internal error" });
      } else {
        res.end();
      }
    }
  };
}

// server.ts
try {
  process.loadEnvFile();
} catch {
}
var env = getEnv();
var port = parseInt(process.env.PORT ?? process.env.SERVER_PORT ?? "3001", 10);
function healthz(_req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
}
function redirectToFrontend(req, res) {
  if (env.DASHBOARD_URL) {
    res.writeHead(302, { Location: env.DASHBOARD_URL + (req.url ?? "/") });
    res.end();
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(
    "Slux backend is running.\nThe dashboard is deployed separately \u2014 set DASHBOARD_URL so this server can redirect to it.\n"
  );
}
async function main() {
  console.log("[slux] Booting backend...");
  const dashboardEnabled = env.DASHBOARD_ENABLED;
  if (!dashboardEnabled) {
    console.log("[slux] Dashboard DISABLED (DASHBOARD_ENABLED=false) \u2014 bot-only mode");
  }
  const apiHandler = createApiHandler();
  const httpServer = createServer((req, res) => {
    try {
      if (req.url === "/healthz") return healthz(req, res);
      if (req.url?.startsWith("/socket.io")) return;
      if (dashboardEnabled && req.url?.startsWith("/api")) {
        void apiHandler(req, res);
        return;
      }
      if (!dashboardEnabled && req.url?.startsWith("/api")) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "dashboard disabled" }));
        return;
      }
      redirectToFrontend(req, res);
    } catch (err) {
      console.error("[slux] HTTP handler error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal error" }));
      }
    }
  });
  let io = null;
  let dashboard = null;
  if (dashboardEnabled) {
    io = new SocketIOServer(httpServer, {
      path: "/socket.io",
      // Reflect any origin: real security is the signed session cookie checked
      // in the /dashboard namespace middleware below — an origin allowlist
      // only broke handshakes when APP_URL didn't exactly match the visited
      // Vercel URL/alias ("websocket error" on the dashboard).
      cors: { origin: true, credentials: true }
    });
    dashboard = io.of("/dashboard");
    dashboard.use(async (socket, next) => {
      const cookie = socket.handshake.headers.cookie ?? "";
      const token = /slux_session=([^;]+)/.exec(cookie)?.[1];
      if (!token) return next(new Error("unauthorized"));
      try {
        const session = await verifySessionToken(decodeURIComponent(token));
        socket.data.userId = session.userId;
        next();
      } catch {
        next(new Error("unauthorized"));
      }
    });
    dashboard.on("connection", (socket) => {
      const userId = socket.data.userId;
      socket.on("guild:join", (guildId) => {
        try {
          if (typeof guildId !== "string") return;
          socket.data.guildId = guildId;
          void socket.join(`guild:${guildId}`);
          const botNow = getBot();
          const player = botNow?.music.getPlayer(guildId);
          if (player) {
            socket.emit("player:snapshot", player.snapshot());
          } else {
            const guild = botNow?.client.guilds.cache.get(guildId);
            socket.emit("player:snapshot", emptyPlayerSnapshot(guildId, guild?.name ?? ""));
          }
        } catch (err) {
          console.error("[slux] socket guild:join error:", err);
        }
      });
      socket.on("guild:leave", (guildId) => {
        try {
          if (typeof guildId !== "string") return;
          void socket.leave(`guild:${guildId}`);
        } catch (err) {
          console.error("[slux] socket guild:leave error:", err);
        }
      });
      socket.on("player:action", (payload, ack) => {
        handlePlayerAction(userId, payload).then((result) => ack?.(result)).catch((err) => {
          console.error("[slux] socket player:action error:", err);
          ack?.({ ok: false, error: "internal error" });
        });
      });
      socket.on("error", (err) => {
        console.error("[slux] socket error:", err?.message ?? String(err));
      });
    });
  }
  const wireBotBus = (bot2) => {
    bot2.bus.on("snapshot", (snapshot) => {
      dashboard?.to(`guild:${snapshot.guildId}`).emit("player:snapshot", snapshot);
    });
    bot2.bus.on("playerDestroy", ({ guildId }) => {
      dashboard?.to(`guild:${guildId}`).emit("player:snapshot", emptyPlayerSnapshot(guildId));
    });
  };
  async function handlePlayerAction(userId, payload) {
    try {
      if (!userId) return { ok: false, error: "unauthorized" };
      const data = payload;
      const botNow = getBot();
      if (!botNow || !data.guildId || typeof data.action !== "string") {
        return { ok: false, error: "bad request" };
      }
      const guild = botNow.client.guilds.cache.get(data.guildId);
      if (!guild) return { ok: false, error: "unknown guild" };
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return { ok: false, error: "not a member" };
      const settings = await getGuildSettings(data.guildId);
      let player = botNow.music.getPlayer(data.guildId);
      const action = data.action;
      if (action === "join") {
        const channelId = typeof data.value === "string" ? data.value : member.voice.channelId;
        if (!channelId) return { ok: false, error: "no voice channel" };
        const channel = guild.channels.cache.get(channelId);
        if (!channel?.isVoiceBased?.()) return { ok: false, error: "invalid channel" };
        const created = await botNow.music.createPlayer(member, channel, null);
        if (!created) return { ok: false, error: "join failed" };
        player = created;
        await player.setVolume(settings.defaultVolume).catch(() => {
        });
        player.autoplay = settings.defaultAutoplay;
        player.stayInChannel = settings.default247;
        player.setIdleTimeout(settings.idleTimeout);
        await player.refreshLocale();
        return { ok: true };
      }
      if (!player) return { ok: false, error: "no player" };
      if (!botNow.canControl(member, settings, player)) {
        return { ok: false, error: "dj mode" };
      }
      const value = data.value;
      switch (action) {
        case "play": {
          const encoded = data.track?.encoded;
          if (typeof encoded === "string" && encoded) {
            const track = await botNow.music.decode(encoded, {
              id: member.id,
              tag: member.user.tag,
              avatar: member.user.displayAvatarURL({ size: 64 })
            });
            if (track) {
              const wasEmpty = !player.current;
              player.enqueue(track);
              if (wasEmpty) await player.startIfIdle();
            }
          } else if (typeof value === "string" && value.trim()) {
            const outcome = await botNow.music.resolve(value, {
              id: member.id,
              tag: member.user.tag,
              avatar: member.user.displayAvatarURL({ size: 64 })
            });
            if (outcome.kind === "track" && outcome.track) {
              const wasEmpty = !player.current;
              player.enqueue(outcome.track);
              if (wasEmpty) await player.startIfIdle();
            } else if (outcome.kind === "playlist" && outcome.tracks) {
              player.enqueueMany(outcome.tracks);
              if (!player.current) await player.startIfIdle();
            } else if (outcome.kind === "search" && outcome.tracks && outcome.tracks.length > 0) {
              const wasEmpty = !player.current;
              player.enqueue(outcome.tracks[0]);
              if (wasEmpty) await player.startIfIdle();
            } else {
              return { ok: false, error: "nothing found" };
            }
          } else {
            return { ok: false, error: "bad request" };
          }
          return { ok: true };
        }
        case "pause":
          await player.pause();
          return { ok: true };
        case "resume":
          await player.resume();
          return { ok: true };
        case "toggle":
          if (player.paused) await player.resume();
          else await player.pause();
          return { ok: true };
        case "skip":
          await player.skip();
          return { ok: true };
        case "previous":
          await player.previous();
          return { ok: true };
        case "stop":
          await botNow.music.destroyPlayer(data.guildId, "stopped");
          return { ok: true };
        case "seek": {
          const ms = Number(value);
          if (!Number.isFinite(ms)) return { ok: false, error: "bad request" };
          await player.seek(ms);
          return { ok: true };
        }
        case "volume": {
          const vol = Number(value);
          if (!Number.isFinite(vol) || vol < 0 || vol > 150) return { ok: false, error: "bad volume" };
          await player.setVolume(vol);
          return { ok: true };
        }
        case "loop": {
          const mode = value === "off" || value === "track" || value === "queue" ? value : player.cycleRepeat();
          await player.setRepeat(mode);
          return { ok: true };
        }
        case "shuffle":
          player.shuffleQueue();
          return { ok: true };
        case "clear":
          player.clearQueue();
          return { ok: true };
        case "remove": {
          const index = Number(value);
          if (!Number.isFinite(index) || index < 1 || index > player.queue.length) {
            return { ok: false, error: "bad index" };
          }
          player.removeAt(index);
          return { ok: true };
        }
        case "moveTop": {
          const index = Number(value);
          if (!Number.isFinite(index) || index < 2 || index > player.queue.length) {
            return { ok: false, error: "bad index" };
          }
          player.moveTrack(index, 1);
          return { ok: true };
        }
        case "move": {
          const move = value;
          const from = Number(move?.from);
          const to = Number(move?.to);
          if (!Number.isFinite(from) || !Number.isFinite(to)) return { ok: false, error: "bad request" };
          player.moveTrack(from, to);
          return { ok: true };
        }
        case "autoplay":
          player.autoplay = !player.autoplay;
          player.emit();
          return { ok: true };
        case "247":
          player.stayInChannel = !player.stayInChannel;
          player.emit();
          return { ok: true };
        case "djmode":
          player.djMode = !player.djMode;
          player.emit();
          return { ok: true };
        case "filter": {
          const name = value?.name;
          if (typeof name !== "string") return { ok: false, error: "bad request" };
          const on = value.on !== false;
          if (on) await player.applyFilter(name, value.param);
          else await player.removeFilter(name);
          return { ok: true };
        }
        case "resetFilters":
          await player.resetFilters();
          return { ok: true };
        default:
          return { ok: false, error: "unknown action" };
      }
    } catch (err) {
      console.error("[slux] socket action error:", err);
      return { ok: false, error: "internal error" };
    }
  }
  httpServer.listen(port, env.HOST, () => {
    console.log(
      `[slux] Backend ready on ${env.APP_URL} (bound to ${env.HOST}:${port}) \u2014 ` + (dashboardEnabled ? `dashboard at ${env.DASHBOARD_URL ?? "(set DASHBOARD_URL)"}` : "dashboard disabled")
    );
  });
  const connectDbWithRetry = async (attempt = 1) => {
    try {
      await connectDatabase();
      console.log("[slux] MongoDB connected");
    } catch (err) {
      console.error(
        `[slux] MongoDB connection failed (attempt ${attempt}):`,
        err instanceof Error ? err.message : err
      );
      setTimeout(() => void connectDbWithRetry(attempt + 1), Math.min(3e4, attempt * 5e3));
    }
  };
  void connectDbWithRetry();
  const bot = getBot() ?? new BotService();
  setBot(bot);
  wireBotBus(bot);
  const loginWithRetry = async (attempt = 1) => {
    try {
      console.log(`[slux] Discord login (attempt ${attempt})\u2026`);
      await bot.login();
      console.log("[slux] Discord gateway connected");
    } catch (err) {
      console.error(
        `[slux] Discord login failed (attempt ${attempt}):`,
        err instanceof Error ? err.message : err
      );
      const delay = Math.min(3e5, attempt * 15e3);
      setTimeout(() => void loginWithRetry(attempt + 1), delay).unref?.();
    }
  };
  void loginWithRetry();
  const loginWatchdog = setTimeout(() => {
    if (!bot.client.isReady()) {
      console.warn(
        "[slux] Discord login still pending after 60s \u2014 check the container's outbound access to discord.com (port 443)"
      );
    }
  }, 6e4);
  loginWatchdog.unref?.();
  const shutdown = async () => {
    console.log("[slux] Shutting down...");
    io?.close();
    await bot.shutdown().catch(() => {
    });
    await disconnectDatabase().catch(() => {
    });
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5e3).unref();
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
void main().catch((err) => {
  console.error("[slux] Fatal boot error:", err);
  process.exit(1);
});
var lastLogged = /* @__PURE__ */ new Map();
function reportGlobalError(kind, err) {
  const message = err instanceof Error ? err.message : String(err);
  const now = Date.now();
  const last = lastLogged.get(message) ?? 0;
  if (now - last < 1e4) return;
  lastLogged.set(message, now);
  if (lastLogged.size > 500) lastLogged.clear();
  console.error(`[slux] ${kind}:`, err instanceof Error ? err.stack ?? err.message : err);
}
process.on("uncaughtException", (err) => reportGlobalError("uncaughtException", err));
process.on("unhandledRejection", (reason) => reportGlobalError("unhandledRejection", reason));
