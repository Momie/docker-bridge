# docker-bridge

 docker-bridge used to communicate with docker api, It helps us to doing many things like send file to container .....

## Installation

```js
$ npm install docker-bridge
```

## Example

  Contrived resource-oriented example:

```js
var dockerBridge = require('./docker-bridge')

var config = {
    host: '127.0.0.1'
    ca: './keys/ca.pem'
    cert: './keys/cert.pem'
    key: './keys/cert.pem'
    path: '/var/run/docker.sock'
}


var docker = dockerBridge.start(config)//new Docker({socketPath: '/var/run/docker.sock'});
// var tty = require('tty');
function *test(next){


  var images = yield (function () {
    return (callback) => docker.listImages(callback)
  })()
  var containers = yield (function () {
    return (callback) => docker.listContainers({all: true} , callback)
  })()

  // create container and it keep alive for 20min
  containerN = yield dockerBridge.new('java:7', '20m')
  // send file to container
  yield dockerBridge.sendFile(containerN, 'your file path' , '/hello.java')
  // exec commande on that container
  var log = yield dockerBridge. execCommand(containerN,["javac","/hello.java"])

```

## License

  MIT
