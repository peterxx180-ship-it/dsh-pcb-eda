# @local/dsh-plugin-manager

One directory-based plugin list with enable/disable switches. Discovers the workspace packages directory from the real location of this linked package and scans for dsh.bundle.patch manifests; utility libraries are excluded. Enabling an unregistered, unloaded plugin registers it through KiCad CLI and requires a restart. Loaded entries are matched by package and patch names, including multiple host/profile origins.

The CLI defaults to dsh-cli.cjs beside the running KiCad Node executable and is checked only when registration is needed. Optional absolute pluginsDir/dshCliPath config overrides support other layouts; a standalone package install needs an explicit catalog directory. Run the installer on each target machine rather than copying another machine's profile links.

Persisted decisions live in the active profile/kicad-plugin-state.json. Startup reconciliation restores choices; old builtin-state.json disabled choices migrate once per plugin and explicit new choices win. Bulk updater preserves existing bundle selections and switch policy. The manager cannot disable itself. Disabling a shared service affects its dependents; dependency switches are not changed automatically. Some browser/dependent capabilities need a restart.

Build, typecheck and test via pnpm --filter @local/dsh-plugin-manager <command>. The package is private and is not published to npm. Paths are deployment configuration in cordis.patch.yml.
