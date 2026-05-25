// Register hook duoc loader goi sau khi load commands.
// Dang ky button handler vao registry chung de interaction-create.js dispatch.

const rpsButtonHandler = require('./handlers/rps-button-handler')
const rollButtonHandler = require('./handlers/roll-button-handler')

module.exports = function register(_client, ctx) {
  ctx.buttonHandlers.push(rpsButtonHandler.handle)
  ctx.buttonHandlers.push(rollButtonHandler.handle)
}
