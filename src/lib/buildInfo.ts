const parsedBuildTime = new Date(__APP_BUILD_TIME__)

export const BUILD_INFO = {
  id: __APP_BUILD_ID__,
  version: __APP_VERSION__,
  builtAt: Number.isNaN(parsedBuildTime.getTime())
    ? __APP_BUILD_TIME__
    : parsedBuildTime.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
} as const
