# THE SYSTEM 2.5.1 — FOUNDATION HARDENING MANIFEST

## Preservation / verification

- source_2_5_app_sha: 0da32905e78637f4320c496b5253740cb7037eeb704b5fc3718e252d239e1e76
- new_app_sha: e68715fcd3074e2e17304de689b5342a1f741336215cc308e44efa3b90014522
- systemCloud_unchanged: True
- systemAI_unchanged: True
- systemAwareness_unchanged: True
- xp_hotfix_preserved: True
- intelligence_x_hotfix_preserved: True
- global_css_extracted: True
- root_boundary: True

## Files

- `App.jsx` — 499545 bytes — SHA256 `e68715fcd3074e2e17304de689b5342a1f741336215cc308e44efa3b90014522`
- `styles/system.css` — 321971 bytes — SHA256 `0a80a5397ff16a446d6c12ccca7667895476e5881af038361083af2503682f42`
- `systemAI.js` — 23978 bytes — SHA256 `5035012f94fbc6e0786f937ea8c2baf3291d063452b546eb57a4afa323abb19d`
- `systemAwareness.js` — 19775 bytes — SHA256 `aeeb149ca80872d587d0d4f8aacbb9a56e4125aea1ce94adb998b52494c80632`
- `systemCloud.js` — 69632 bytes — SHA256 `e9dd87a45b3ef58d15b7632621e1444e9135c8f586fd9f66acfc77e2dc6e980b`
- `systemExternal.js` — 3486 bytes — SHA256 `68b35da317f5ecb09df2dd758023fba23e8a85e8cfeefbb36974a2ba0ad1f280`
- `systemExternalCore.js` — 1637 bytes — SHA256 `7b16075e5d73ddba82e6b35381648392c2e5e269b17aded5b07babf05e774741`
- `supabase/functions/system-content-api/index.ts` — 10709 bytes — SHA256 `cc6d5538b53d5d588b87c3a77dcce7359cebc21da494595e6d9d23063c7324a2`
- `supabase/functions/system-content-api/deno.json` — 50 bytes — SHA256 `fc9fc38c21441b7f67a91280ed28b8ca4ad67fc69d713db441f5c0fd9a6abf9f`
- `supabase/functions/system-intelligence-responder/index.ts` — 20821 bytes — SHA256 `978370ca03379cfccd6c62196a407b007c7c711fa2411901fc88a3c0392300c5`
- `supabase/functions/system-intelligence-responder/deno.json` — 50 bytes — SHA256 `fc9fc38c21441b7f67a91280ed28b8ca4ad67fc69d713db441f5c0fd9a6abf9f`
- `AGENTS.md` — 28360 bytes — SHA256 `88b64cd4f338b7ac97c0c73a6f612405efe5447c3884d67147c1d73914143301`
- `API_SETUP.md` — 6250 bytes — SHA256 `646721f685aa5879785391cb19681ee12f55f8a45496c611b1e474e00e8cc147`
- `INSTALL_2_5_1.md` — 1718 bytes — SHA256 `7028c8fc78b3e988eae5218b0fea9d96075e8533108a32415408fa09379e1de5`
- `docs/ARCHITECTURE.md` — 2595 bytes — SHA256 `46e08db8c6489568419b2bc9375a2e6c2aec894a3b9d77d54df75146e2c0859e`
- `docs/EDGE_FUNCTIONS.md` — 1824 bytes — SHA256 `ec1254734dcd4423fad40694a0d0a195c3f5ba97da073523f0e098ef3920685e`
- `docs/ASYNC_SAFETY.md` — 1102 bytes — SHA256 `b3763bcb0aefec4d03220e97138e8587bd17d89cefec05385d92caa6e90bc554`
- `CODEX_HANDOFF_2_5_1.md` — 1211 bytes — SHA256 `cf6c218c587e1934695bb4c09bc94ebf168e745275e839e28aee3663dffcdf79`
- `tests/systemAI.test.mjs` — 2032 bytes — SHA256 `27ece57fb9e973896f4219fa0b6242fc2dcfe072de4db6045b1752a95943bbeb`
- `tests/systemExternalCore.test.mjs` — 911 bytes — SHA256 `77a80ad875305f2bbe0116b1a160f927aab59c83198b6d6154fa1d2ed1e9e03d`
- `tests/module-loader.mjs` — 360 bytes — SHA256 `b5ca8139b9f07de982dade13f2bb93086d5c19e9cc4c974babfdcda364d67f64`


## Supabase deployment

- `system-api` — ACTIVE v8 — unchanged
- `system-content-api` — ACTIVE v3 — 2.5.1 hardening deployed
- `system-intelligence-responder` — ACTIVE v4 — 2.5.1 hardening deployed
- JWT verification remains enabled on all three functions
