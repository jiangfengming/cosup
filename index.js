const COS = require('cos-nodejs-sdk-v5')
const readdirp = require('readdirp')
const minimatch = require('minimatch')
const url = require('url')
const fs = require('fs')
const path = require('path')
const progress = require('cli-progress')

module.exports = async({
  src,
  dest,
  secretId,
  secretKey,
  region,
  bucket,
  maxAge = ['*.html', 10, '*', 2592000],
  contentType,
  ignore,
  parallel = 10,
  log
}) => {
  if (!dest.endsWith('/')) {
    dest += '/'
  }

  let files

  const stats = fs.statSync(src)

  if (stats.isDirectory()) {
    const filter = ignore && ignore.length
      ? file => !ignore.some(pattern => minimatch(file.path, pattern, { matchBase: true }))
      : () => true

    files = await readdirp.promise(src, { fileFilter: filter, directoryFilter: filter, alwaysStat: true })
  } else if (stats.isFile()) {
    files = [{
      path: path.basename(src),
      fullPath: path.resolve(src),
      basename: path.basename(src),
      stats
    }]
  }

  const cos = new COS({
    SecretId: secretId,
    SecretKey: secretKey,
    FileParallelLimit: parallel
  })

  const errors = []
  const tasks = []

  for (const file of files) {
    let CacheControl

    if (maxAge) {
      for (let i = 0; i < maxAge.length; i += 2) {
        const pattern = maxAge[i]

        if (minimatch(file.path, pattern, { matchBase: true })) {
          const age = parseInt(maxAge[i + 1])

          if (!isNaN(age)) {
            CacheControl = 'max-age=' + age
          }

          break
        }
      }
    }

    let ContentType

    if (contentType) {
      for (let i = 0; i < contentType.length; i += 2) {
        const pattern = contentType[i]

        if (minimatch(file.path, pattern, { matchBase: true })) {
          ContentType = contentType[i + 1]
          break
        }
      }
    }

    let onProgress, bar

    if (log) {
      bar = new progress.Bar(
        {
          format: file.path + ' [{bar}] {percentage}% | {value}/{total}',
          clearOnComplete: true
        },
        progress.Presets.shades_classic
      )

      bar.start(file.stats.size, 0)

      // { loaded, total, speed, percent }
      onProgress = p => p && bar.update(p.loaded)
    }

    tasks.push(new Promise((resolve, reject) => {
      cos.putObject({
        Region: region,
        Bucket: bucket,
        Key: url.resolve(dest, file.path),
        Body: fs.createReadStream(file.fullPath),
        ContentLength: file.stats.size,
        CacheControl,
        ContentType,
        onProgress
      }, e => {
        if (e) {
          if (log) {
            bar.update(0)
            bar.stop()
          }

          reject(e)
        } else {
          if (log) {
            bar.stop()
            console.log(file.path, 'uploaded') // eslint-disable-line no-console
          }

          resolve()
        }
      })
    }).catch(error => {
      errors.push({ file: file.path, error })

      if (log) {
        console.error(file.path, 'upload failed.', error) // eslint-disable-line no-console
      }
    }))
  }

  return Promise.all(tasks).then(() => {
    if (errors.length) {
      throw errors
    }
  })
}
