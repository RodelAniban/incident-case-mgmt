// Runs before any test file's module graph resolves — must be a setupFiles
// entry, not code inside a spec file, because AppModule reads this env var
// at @Module decoration time (i.e. at import time), not inside a factory.
// See src/app.module.ts and src/common/guards/allow-all.guard.ts.
process.env.DISABLE_THROTTLING = 'true';
