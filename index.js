const COS = require('cos-nodejs-sdk-v5')
const readdirp = require('readdirp')
const minimatch = require('minimatch')
const path = require('path')
const fs = require('fs')
const progress = require('cli-progress')

module.exports = function({
  src,
  dest,
  secretId,
  secretKey,
  region,
  bucket,
  maxAge = ['*.html', 10, '*', 2592000],
  ignore,
  parallel = 10,
  log
}) {
  return new Promise((resolve, reject) => {
    const filter = ignore && ignore.length ?
      file => !ignore.some(pattern => minimatch(file.path, pattern, { matchBase: true }))
      : undefined

    readdirp({ root: src, fileFilter: filter, directoryFilter: filter }, (e, { files }) => {
      if (e) {
        return reject(e)
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

        let onProgress, bar
        if (log) {
          bar = new progress.Bar({
            format: file.path + ' [{bar}] {percentage}% | {value}/{total}'
          }, progress.Presets.shades_classic)

          bar.start(file.stat.size, 0)

          // { loaded, total, speed, percent }
          onProgress = p => {
            if (p) {
              bar.update(p.loaded)
            }
          }
        }

        tasks.push(new Promise((resolve, reject) => {
          cos.putObject({
            Region: region,
            Bucket: bucket,
            Key: path.join(dest, file.path),
            Body: fs.createReadStream(file.fullPath),
            ContentLength: file.stat.size,
            CacheControl,
            onProgress
          }, e => {
            if (e) {
              bar.update(0)
              bar.stop()
              reject(e)
            } else {
              bar.stop()
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

      Promise.all(tasks).then(() => {
        if (errors.length) {
          reject(errors)
        } else {
          resolve()
        }
      })
    })
  })
}
