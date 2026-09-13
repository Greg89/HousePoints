export type MobilePrimaryDestination = {
  route: "index" | "activity" | "leaderboard" | "admin";
  title: "Home" | "Activity" | "Leaderboard" | "Manage";
  icon: "chart-bar" | "clock-outline" | "trophy-outline" | "wrench-outline";
  activeIcon: "chart-bar" | "clock" | "trophy" | "wrench";
  visible: boolean;
};

export function mobilePrimaryNavigation(
  canManage: boolean,
): MobilePrimaryDestination[] {
  return [
    {
      route: "index",
      title: "Home",
      icon: "chart-bar",
      activeIcon: "chart-bar",
      visible: true,
    },
    {
      route: "activity",
      title: "Activity",
      icon: "clock-outline",
      activeIcon: "clock",
      visible: true,
    },
    {
      route: "leaderboard",
      title: "Leaderboard",
      icon: "trophy-outline",
      activeIcon: "trophy",
      visible: true,
    },
    {
      route: "admin",
      title: "Manage",
      icon: "wrench-outline",
      activeIcon: "wrench",
      visible: canManage,
    },
  ];
}
