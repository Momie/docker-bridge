var Docker = require('dockerode');
var fs = require('fs')
var docker;
// var docker = new Docker({socketPath: '/var/run/docker.sock'});
//                         CTRL_P = '\u0010',
//                         CTRL_Q = '\u0011';

module.exports.start = function(config){
  /* config example {
      host: '127.0.0.1'
      ca: './keys/ca.pem'
      cert: './keys/cert.pem'
      key: './keys/cert.pem'
      path: '/var/run/docker.sock'
  } */
  if (config.path) {
    docker = new Docker({socketPath: config.path})
    return docker
  }
  if (config.key && config.ca && config.key) {
    docker = new Docker({
        host: config.host || '127.0.0.1',
        port: config.port || 2376,
        ca: fs.readFileSync(config.ca),
        cert: fs.readFileSync(config.cert),
        key: fs.readFileSync(config.key)
     });
     return docker
  }
  docker = new Docker({host: config.host || '127.0.0.1' , port: config.port || 2376})
  return docker
}


module.exports.new = create = function* (image, time) {
  var images = yield (function () {
    return (callback) => docker.listImages(callback)
  })()
  var asExist = false
  images.map(function(e){
    if (e.RepoTags.indexOf(image) > -1) asExist = true
  })
  if(!asExist) yield dockerBridge.pullImage(image)

  return new Promise(function(resolve, reject){
    docker.createContainer({Image: image,
                            Tty: false ,
                            // Cmd: ['tail', '-f' , '/dev/null']
                            Cmd: ['sleep', time || '5m']
                            // ,name: 'java-test'
                          }, function (err, container) {
                            if (err) return reject(err)
                            container.start(function(err, data){
                              if (err) return reject(err)
                              resolve(container)
                            })
                          })
  })
}

module.exports.cleanDied = cleanDied = function (force) {
  return new Promise(function (resolve , reject) {
    docker.listContainers({all: true} , function(err, cList){
      Promise.all(cList.map(function(e){
        var callback = function(err,res){}
        docker.getContainer(e.Id).remove(callback)
        return callback
      })).then(function(res){
        resolve(res)
      }).catch(reject)
    })
  })
}

module.exports.pullImage = pullImage = function (ImageTag) {
  return new Promise(function (resolve , reject) {
    docker.pull(ImageTag, {} , function(err, data){
      if(err) return reject(err)
      var lops = setInterval(function (){
        docker.listImages(function(err, containers){
          containers.map(function(e){
            if(e && e.RepoTags && e.RepoTags.indexOf(ImageTag) > -1) {
              clearInterval(lops);
              return resolve(e)
            }
          })
        })
      }, 500)
    })
  })
}

module.exports.sendFile = sendFile = function (container , file , path) {
  return new Promise(function (resolve , reject) {
      try {
        container.exec({Cmd: ["sh", "-c" , "cat > " + path ], AttachStdin: true, AttachStdout: true}, function(err, exec) {
          console.log(err, 'Error while sending file')
          if (err || !exec ) return reject(err)
          exec.start({hijack: true, stdin: true}, function(err, stream) {
             stream.on('close', function(){
               resolve(true)
             })
             stream.on('error', function(err){
               reject(err)
             })
             fs.createReadStream(file , 'binary').pipe(stream);
          })
        })
      } catch(e) {
        reject(e)
      }
  })
}

module.exports.createFile = createFile = function (container , data , path) {
  return new Promise(function (resolve , reject) {
      try {
        container.exec({Cmd: ["sh", "-c" , "cat > " + path ], AttachStdin: true, AttachStdout: true}, function(err, exec) {
          console.log(err, 'Error while sending file')
          if (err || !exec ) return reject(err)
          exec.start({hijack: true, stdin: true}, function(err, stream) {
             stream.on('close', function(){
               resolve(true)
             })
             stream.on('error', function(err){
               reject(err)
             })
             stream.on('end', function(){
               resolve(data)
             })
             stream.write(data)
             stream.write('\n')
             stream.end()
          })
        })
      } catch(e) {
        reject(e)
      }
  })
}

module.exports.execCommand = function (container , cmd , stdin) {
  return new Promise(function (resolve , reject) {
      try {
        container.exec({Cmd: cmd, AttachStdin: true, AttachStdout: true ,Tty: true, AttachStderr: true}, function(err, exec) {
          if (err || !exec ) {
            console.log(err, 'Error while exec command')
            return reject(err)
          }
          var data = []
          exec.start({hijack: true, stdin: true}, function(err, stream) {
             // console.log(err , stream)
             stream.on('close', function(){
               resolve(data)
             })
             stream.on('end', function(){
               resolve(data)
             })
             stream.on('error', function(err){
               console.log(err)
               reject(err)
             })
             stream.on('data', function(newdata){
               console.log(newdata.toString('utf8'))
               data.push(newdata.toString('utf8').replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, ''))
             })
             stream.write('\n')
          })
        })
      } catch(e) {
        reject(e)
      }
  })
}

function containerLogs(container) {

  // create a single stream for stdin and stdout
  var logStream = new stream.PassThrough();
  logStream.on('data', function(chunk){
    console.log(chunk.toString('utf8'));
  });

  container.logs({
    follow: true,
    stdout: true,
    stderr: true
  }, function(err, stream){
    if(err) {
      return logger.error(err.message);
    }
    container.modem.demuxStream(stream, logStream, logStream);
    stream.on('end', function(){
      logStream.end('!stop!');
    });
  });
}
function runExec(container , cmd) {

  var options = {
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true
  };

  container.exec(options, function(err, exec) {
    if (err) return;
    exec.start(function(err, stream) {
      if (err) return;

      container.modem.demuxStream(stream, process.stdout, process.stderr);

      exec.inspect(function(err, data) {
        if (err) return;
        console.log(data);
      });
    });
  });
}
