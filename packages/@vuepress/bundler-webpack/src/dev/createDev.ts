import * as webpack from 'webpack'
import * as WebpackDevServer from 'webpack-dev-server'
import type { App, BundlerDev } from '@vuepress/core'
import { chalk, logger, ora } from '@vuepress/utils'
import type { WebpackBundlerOptions } from '../types'
import { resolveWebpackConfig } from '../utils'
import { createDevConfig } from './createDevConfig'
import { createDevServerConfig } from './createDevServerConfig'
import { resolvePort } from './resolvePort'

export const createDev = (options: WebpackBundlerOptions): BundlerDev => async (
  app: App
) => {
  // resolve host and port
  const host = app.options.host
  const port = await resolvePort(app.options.port)

  // create webpack config
  const config = await createDevConfig(app, options)
  const webpackConfig = resolveWebpackConfig({
    config,
    options,
    isServer: false,
    isBuild: false,
  })

  // create webpack compiler
  const compiler = webpack(webpackConfig)

  // create webpack-dev-server
  const serverConfig = createDevServerConfig(app, options)
  const server = new WebpackDevServer(compiler, serverConfig)

  // create spinner
  const spinner = ora()
  let hasStarted = false
  let hasFinished = false

  // start spinner before the first compilation
  compiler.hooks.beforeCompile.tap('vuepress-dev', () => {
    if (hasStarted) return
    hasStarted = true

    spinner.start('Compiling with webpack...')
  })

  // stop spinner and reject error if the first compilation is failed
  compiler.hooks.failed.tap('vuepress-dev', () => {
    if (hasFinished) return
    hasFinished = true

    spinner.fail('Compilation failed')
  })

  // stop spinner, show compilation time and print url after first compilation
  compiler.hooks.done.tap('vuepress-dev', ({ endTime, startTime }) => {
    if (hasFinished) return
    hasFinished = true

    spinner.succeed(`Compilation finished in ${endTime! - startTime!}ms`)

    // replace `0.0.0.0` with `localhost` as `0.0.0.0` is not available on windows
    const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}${
      app.options.base
    }`
    logger.success(
      `VuePress webpack dev server is listening at ${chalk.cyan(url)}`
    )
  })

  // start dev-server and return the close function
  return new Promise((resolve, reject) => {
    server.listen(port, host, (err) => {
      if (err) {
        logger.error(`VuePress dev server failed to start`)
        return reject(err)
      }

      // promisify the close function
      const close = (): Promise<void> =>
        new Promise((resolve) => server.close(resolve))

      // resolve the close function
      resolve(close)
    })
  })
}
