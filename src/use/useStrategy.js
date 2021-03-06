"use strict"

//Give a strategy to expressLogin
//Called just like app.use or router.use
//example: expressLogin.useStrategy('/local', localStrategy)

var config = require('../config')
var router = require('../router')

module.exports = (routeStr, strategy) => {
  //Check if only one argument
  //by rights, the optional argument should be second but the intent
  //is to mimic app.use
  if (!strategy) {
    strategy = routeStr
    routeStr = undefined
  }

  var strategyRouter = strategy(config)

  if (routeStr)
    router.use(routeStr, strategyRouter)
  else
    router.use(strategyRouter)
}
