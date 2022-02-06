function info(msg, caller = null) {
  console.log(`[INFO]${getTimeText()}${caller ? `[${caller}]` : ""} ${msg}`)
}

function error(msg, caller = null) {
  console.log(`[EROR]${getTimeText()}${caller ? `[${caller}]` : ""} ${msg}`)
}

function getTimeText() {
  const now = new Date()
  const date = `[${now.getFullYear()}/${z(now.getMonth())}/${z(now.getDay())}`
  const time = ` ${z(now.getHours())}:${z(now.getMinutes())}:${z(now.getSeconds())}]`
  return date + time
}

function z(str) {
  return ("0" + str).slice(-2)
}

module.exports = {info, error}