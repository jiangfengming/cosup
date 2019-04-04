# cosup
腾讯云对象存储（COS）资源上传命令行工具。

## 目的
1. 在 CI 任务里使用官方 python 版命令行工具（COSCMD）需要在基础 node docker 镜像上安装 pip，再使用 pip 安装 COSCMD，太麻烦。
2. 我需要在上传时根据不同文件类型设置不同的 `max-age`。COSCMD 无法满足需求。

## 命令行
全局安装：
```
npm i -g cosup
```

或者安装在项目中：
```
npm i cosup
```
然后在 `package.json` 中加入 script:
```json
{
  "scripts": {
    "deploy": "cosup -u xxx -p xxx -r ap-shanghai -b test-123456 dist /"
  }
}
```

```
cosup [src] [dest]

Upload files in [src] directory to [dest] directory on COS.

Options:
  --help, -h        Show help                                          [boolean]
  --version, -v     Show version number                                [boolean]
  --config, -c      Path to JSON config file
  --secret-id, -u   SecretId                                          [required]
  --secret-key, -p  SecretKey                                         [required]
  --region, -r      Region                                            [required]
  --bucket, -b      Bucket                                            [required]
  --max-age, -e     Cache-Control: max-age header
                                [array] [default: -e "*.html" 10 -e "*" 2592000]
  --ignore, -i      Don' upload the files which matches the glob pattern. e.g.
                    -i "*.sh" -i ".gitignore"                            [array]
  --parallel, -n    Parallel upload limit                 [number] [default: 10]
  --log, -l         Output logs to console             [boolean] [default: true]

Examples:
  cosup -u xxx -p xxx -r ap-shanghai -b test-123456 dist /
```

### 环境变量
参数可以通过 `COS_*` 前缀的环境变量传入，比如：
```
COS_SECRET_ID=xxx COS_SECRET_KEY=xxx COS_REGION=ap-shanghai COS_BUCKET=test-12345 cosup dist / 
```
在 CI 工具中配置环境变量，可以方便地作为参数传入。

### 配置文件
参数还可以通过 `json` 配置文件传入。比如：

```
cosup -c config.json
```

`config.json`:
```json
{
  "secretId": "xxx",
  "secretKey": "xxx",
  "region": "ap-shanghai",
  "bucket": "test-12345",
  "src": "dist",
  "dest": "/",
  "maxAge": ["*.html", 10, "*", 2592000],
  "ignore": ["*.sh", ".gitignore"]
}
```

### 参数优先级
命令行参数 > 环境变量 > 配置文件

### Windows 注意事项
在 Windows 的 Git Bash/MSYS2 命令行中，路径会被转换导致上传的文件路径不对，需要设置环境变量 `MSYS_NO_PATHCONV=1`。
```
MSYS_NO_PATHCONV=1 cosup -c config.json dist /
```

## 作为模块使用
```js
const cosup = require('cosup')
```

```js
cosup({
  src,
  dest,
  secretId,
  secretKey,
  region,
  bucket,
  maxAge = ['*.html', 10, '*', 2592000],
  ignore
  parallel = 10
  log
})
```

### src
`String`。源文件夹

### dest
`String`。COS目标文件夹

### secretId
`String`。开发者拥有的项目身份识别 ID，用以身份认证

### secretKey
`String`。开发者拥有的项目身份密钥

### region
`String`。域名中的地域信息。枚举值参见 [可用地域](https://cloud.tencent.com/document/product/436/6224) 文档，如：ap-beijing, ap-hongkong, eu-frankfurt 等

### bucket
`String`。COS 中用于存储数据的容器

### maxAge
`Array`。文件的 `Cache-Control: max-age` 头信息。 格式：`[pattern, maxAge, pattern, maxAge, ...]`。
匹配 `pattern` 的文件的 `max-age` 为 `pattern` 右边的元素值。数组顺序很重要，当找到第一条匹配的规则即停止寻找。
比如 `['*.html', 10, '*', 2592000]`，`index.html` 的 `max-age` 为 10 秒，`favicon.png` 的 `max-age` 为 2592000 秒。

pattern 写法参考 [glob](https://github.com/isaacs/node-glob#glob-primer)。

默认值：`['*.html', 10, '*', 2592000]`

### ignore
`Array`。不上传匹配的的文件。比如：`['*.sh', '.gitignore']`

### parallel
`Number`。上传并发数。默认值：10

### log
`Boolean`。是否在控制台打印上传进度。`Cli` 模式默认为 `true`, 作为模块使用默认为 `false`。

## License
[MIT](LICENSE)
