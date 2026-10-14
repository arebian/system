THE SYSTEM — PHASE 8: INVENTORY + REWARDS

- Reward claiming is backend-authoritative.
- Claiming the same reward twice is idempotent.
- Equipped/showcase state is backend-owned and ownership-validated.
- Inventory hydration already reads Boss trophies and other backend items.
- Legacy syncStructuredProfile no longer deletes/recreates inventory or rewards.
- Boss trophies therefore survive unrelated local profile saves.
- Inventory detail adds EQUIP/UNEQUIP and SHOWCASE/REMOVE SHOWCASE controls for backend gear.

Manual gear/reward creation remains legacy UI for now; it is intentionally no longer allowed to overwrite the authoritative backend vault through generic profile sync. A later creator/admin patch can give manual items a dedicated controlled backend action.

REPLACE ONLY:
src/App.jsx
src/systemCloud.js

KEEP .env.local
RUN npm run dev
