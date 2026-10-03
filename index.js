// ponytail: terminal bell on session.idle, upgrade to osascript notify if you want popups
export const NotificationPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await $`printf '\\a'`
      }
    },
  }
}
