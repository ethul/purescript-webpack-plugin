'use strict';

var path = require('path');

var fs = require('fs');

var child_process = require('cross-spawn-async');

var dargs = require('dargs');

var debug = require('debug')('purescript-webpack-plugin');

var fileGlobber = require('./file-globber');

var modificationMap = require('./modification-map');

var moduleMap = require('./module-map');

var requireMap = require('./require-map');

var dependencyGraph = require('./dependency-graph');

var moduleParser = require('./module-parser');

var REQUIRE_PATH = '../';

var PURS = '.purs';

function PurescriptWebpackPlugin(options) {
  this.options = Object.assign({
    src: [
      path.join('src', '**', '*.purs'),
      path.join('bower_components', 'purescript-*', 'src', '**', '*.purs')
    ],
    ffi: [
      path.join('src', '**', '*.js'),
      path.join('bower_components', 'purescript-*', 'src', '**', '*.js')
    ],
    output: 'output',
    bundleOutput: path.join('output', 'bundle.js'),
    bundleNamespace: 'PS',
    psc: 'psc',
    pscArgs: {},
    pscBundle: 'psc-bundle',
    pscBundleArgs: {},
    bundle: true
  }, options);

  this.context = {
    options: this.options
  };

  this.cache = {
    srcFiles: [],
    ffiFiles: [],
    outputFiles: [],
    srcModificationMap: modificationMap.emptyMap(),
    ffiModificationMap: modificationMap.emptyMap(),
    srcModuleMap: moduleMap.emptyMap(),
    ffiModuleMap: moduleMap.emptyMap(),
    requireMap: requireMap.emptyMap(),
    dependencyGraph: dependencyGraph.emptyGraph()
  };
}

PurescriptWebpackPlugin.prototype.bundleModuleNames = function(){
  var entries = this.context.bundleEntries;

  var modules = this.context.compilation.modules;

  var moduleNames = entries.map(function(entry){
    var module_ = modules.filter(function(module_){
      return module_.userRequest === entry.userRequest;
    });

    if (!module_[0]) return null;
    else {
      var file = module_[0].resource;

      var result = moduleParser.srcNameSync(file);

      return result;
    }
  });

  var nonNullNames = moduleNames.filter(function(name){ return name !== null; });

  return nonNullNames;
};

PurescriptWebpackPlugin.prototype.bundle = function(callback){
  var moduleNames = this.bundleModuleNames();

  if (moduleNames.length === 0) callback(new Error("No entry point module names found."), null);
  else {
    var args = Object.assign({}, this.options.pscBundleArgs, {
      module: moduleNames,
      namespace: this.options.bundleNamespace,
      requirePath: REQUIRE_PATH,
      _:  [
        path.join(this.options.output, '**', 'index.js'),
        path.join(this.options.output, '**', 'foreign.js')
      ]
    });

    var args_ = dargs(args, {ignoreFalse: true});

    debug('Spawning %s %o', this.options.pscBundle, args_);

    var pscBundle = child_process.spawn(this.options.pscBundle, args_);

    var stdout = '';

    var stderr = '';

    pscBundle.stdout.on('data', function(data){
      stdout = stdout + data.toString();
    });

    pscBundle.stderr.on('data', function(data){
      stderr = stderr + data.toString();
    });

    pscBundle.on('close', function(code){
      var error = code !== 0 ? new Error(stderr) : null;
      callback(error, stdout);
    });
  }
};

PurescriptWebpackPlugin.prototype.compile = function(callback){
  var args = Object.assign({}, this.options.pscArgs, {
    ffi: this.options.ffi,
    output: this.options.output,
    requirePath: REQUIRE_PATH,
    _: this.options.src
  });

  var args_ = dargs(args, {ignoreFalse: true});

  debug('Spawning %s %o', this.options.psc, args_);

  var psc = child_process.spawn(this.options.psc, args_);

  var stderr = '';

  psc.stderr.on('data', function(data){
    stderr = stderr + data.toString();
  });

  psc.on('close', function(code){
    var error = code !== 0 ? new Error(stderr) : null;
    callback(error, stderr);
  });
};

PurescriptWebpackPlugin.prototype.updateDependencies = function(callback){
  var plugin = this;

  var cache = plugin.cache;

  plugin.scanFiles(function(error, result){
    if (error) callback(error, cache);
    else {
      moduleMap.insertSrc(result.srcFiles, cache.srcModuleMap, cache.srcModificationMap, result.srcModificationMap, function(error, srcMap){
        if (error) callback(error, cache);
        else {
          moduleMap.insertFFI(result.ffiFiles, cache.ffiModuleMap, cache.ffiModificationMap, result.ffiModificationMap, function(error, ffiMap){
            if (error) callback(error, cache);
            else {
              requireMap.insertOutput(result.outputFiles, cache.requireMap, srcMap, ffiMap, cache.srcModificationMap, result.srcModificationMap, cache.ffiModificationMap, result.ffiModificationMap, function(error, requireMap) {
                if (error) callback(error, cache);
                else {
                  dependencyGraph.insertFromOutput(result.outputFiles, requireMap, srcMap, ffiMap, dependencyGraph.emptyGraph(), function(error, graph){
                    if (error) callback(error, cache);
                    else {
                      var result_ = {
                        srcFiles: result.srcFiles,
                        ffiFiles: result.ffiFiles,
                        outputFiles: result.outputFiles,
                        srcModificationMap: result.srcModificationMap,
                        ffiModificationMap: result.ffiModificationMap,
                        srcModuleMap: srcMap,
                        ffiModuleMap: ffiMap,
                        requireMap: requireMap,
                        dependencyGraph: graph
                      };

                      callback(null, result_);
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
};

PurescriptWebpackPlugin.prototype.scanFiles = function(callback){
  var plugin = this;

  var outputGlob = path.join(plugin.options.output, '**', '*.js');

  fileGlobber.glob(plugin.options.src, function(error, srcs){
    if (error) callback(error, null);
    else {
      fileGlobber.glob(plugin.options.ffi, function(error, ffis){
        if (error) callback(error, null);
        else {
          fileGlobber.glob([outputGlob], function(error, output){
            if (error) callback(error, null);
            else {
              modificationMap.insert(srcs, modificationMap.emptyMap(), function(error, srcMap){
                if (error) callback(error, null);
                else {
                  modificationMap.insert(ffis, modificationMap.emptyMap(), function(error, ffiMap){
                    if (error) callback(error, null);
                    else {
                      var result = {
                        srcFiles: srcs,
                        ffiFiles: ffis,
                        outputFiles: output,
                        srcModificationMap: srcMap,
                        ffiModificationMap: ffiMap
                      };

                      callback(null, result);
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
};

PurescriptWebpackPlugin.prototype.contextCompile = function(callback){
  var plugin = this;

  return function(){
    var callbacks = plugin.context.callbacks;
    var compilation = plugin.context.compilation;

    callbacks.push(callback);

    var invokeCallbacks = function(error, graph, output) {
      if (output) {
        compilation.warnings.push('Compilation Result\n\n' + output);
      }

      if (error) {
        compilation.errors.push('Compilation Result\n\n' + error);
      }

      callbacks.forEach(function(callback){
        callback(error)(graph)();
      });
    };

    if (plugin.context.requiresCompiling) {
      plugin.context.requiresCompiling = false;

      debug('Compiling PureScript files');

      plugin.compile(function(error, output){
        if (error) invokeCallbacks(error, plugin.cache.dependencyGraph, output);
        else {
          debug('Updating dependency graph of PureScript bundle');

          plugin.updateDependencies(function(error, result){
            Object.assign(plugin.cache, result);

            debug('Generating result for webpack');

            if (!plugin.options.bundle) invokeCallbacks(error, plugin.cache.dependencyGraph, output);
            else {
              debug('Bundling compiled PureScript files');

              plugin.bundle(function(error, bundle){
                if (error) invokeCallbacks(error, plugin.cache.dependencyGraph, output);
                else {
                  var bundle_ = bundle + 'module.exports = ' + plugin.options.bundleNamespace + ';';

                  fs.writeFile(plugin.options.bundleOutput, bundle_, function(error_){
                    invokeCallbacks(error_ || error, plugin.cache.dependencyGraph, output);
                  });
                }
              });
            }
          });
        }
      });
    }
  };
};

PurescriptWebpackPlugin.prototype.apply = function(compiler){
  var plugin = this;

  compiler.plugin('compilation', function(compilation, params){
    Object.assign(plugin.context, {
      requiresCompiling: true,
      bundleEntries: [],
      callbacks: [],
      compilation: null,
      compile: plugin.contextCompile.bind(plugin)
    });

    compilation.plugin('normal-module-loader', function(loaderContext, module){
      if (path.extname(module.userRequest) === PURS) {
        plugin.context.compilation = compilation;
        loaderContext.purescriptWebpackPluginContext = plugin.context;
      }
    });
  });

  compiler.plugin('normal-module-factory', function(normalModuleFactory){
    normalModuleFactory.plugin('after-resolve', function(data, callback){
      if (path.extname(data.userRequest) === PURS) {
        plugin.context.bundleEntries.push(data);
      }
      callback(null, data);
    });
  });
};

module.exports = PurescriptWebpackPlugin;
