export type MobilePrimaryDestination = {
  route: "index" | "activity" | "leaderboard" | "admin";
  title: "Home" | "Activity" | "Leaderboard" | "Manage";
  visible: boolean;
};

export function mobilePrimaryNavigation(
  canManage: boolean,
): MobilePrimaryDestination[] {
  return [
    { route: "index", title: "Home", visible: true },
    { route: "activity", title: "Activity", visible: true },
    { route: "leaderboard", title: "Leaderboard", visible: true },
    { route: "admin", title: "Manage", visible: canManage },
  ];
}
