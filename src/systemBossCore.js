function inventoryEntries(profile) {
  return [
    ...(Array.isArray(profile?.customInventory)
      ? profile.customInventory
      : []),
    ...(Array.isArray(profile?.backendState?.inventory)
      ? profile.backendState.inventory
      : []),
  ];
}

export function hasRaidEntryKey(profile) {
  return inventoryEntries(profile).some((item) => {
    const text = [
      item?.name,
      item?.slug,
      item?.item_catalog?.slug,
      item?.item_catalog?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();

    return text
      .replace(/[^A-Z0-9]+/g, " ")
      .trim()
      .includes("RAID ENTRY KEY");
  });
}
