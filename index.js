const potrace = require('potrace')
const fs = require('fs').promises;
const fsr = require('fs');
const {PythonShell} = require("python-shell")
const sharp = require("sharp")
const Neos = require("@bombitmanbomb/neosjs")
const axios = require("axios")
const http = require('https')
const express = require("express")
const app = express()
const buttonTemplate = require("./Button.json")
const {info, error} = require("./logger")


app.use(express.static('./ttf'))
app.get("/button.json", (req, res) => {
  const query = (req.query.url).replace(".", "/")
  res.send(JSON.stringify(buttonTemplate).replace("REPLACE_HERE", query))
})

const server = app.listen(4000, function () {
  info("ok port:" + server.address().port)
});

async function getFiles(userId, tmpId) {
  const files = await fs.readdir(`./image/${userId}/${tmpId}`)
  return files
}

async function generate(userId, tmpId) {
  // const tmpId = userId // + Math.random().toString(32).substring(2)
  const files = await getFiles(userId, tmpId)
  const heights = []
  for (const file of files) {
    const image = sharp(`./image/${userId}/${tmpId}/${file}`)
    const metadata = await image.metadata()
    heights.push(metadata.width)
    await image.toFile(`./trimed/${userId}/${tmpId}/${file}`)
    await trace(`./trimed/${userId}/${tmpId}/${file}`, `./svg/${userId}/${tmpId}/${file.split(".")[0]}.svg`)
  }
  PythonShell.run("./python/convert.py", {args: [JSON.stringify(generateConfig(files, heights, tmpId, userId))]}, function (err, output) {
    if (err) throw err
    info("Font Generate OK")
  })
}

function trace(inFile, outFile) {
  return new Promise((res, rej) => {
    potrace.trace(inFile, async function (err, svg) {
      if (err) throw err;
      await fs.writeFile(outFile, svg);
      res()
    });
  })
}


function generateConfig(files, heights, tmpId, userId, fontName = "NeosFont") {
  const glyphs = {}
  files.forEach((file, index) => {
    const name = file.split(".")[0]
    glyphs[name] = {
      "src": `svg/${userId}/${tmpId}/${name}.svg`,
      "width": heights[index],
      "height": 512
    }
  })

  return {
    "props": {
      "ascent": 96,
      "descent": 32,
      "em": 512,
      "encoding": "UnicodeFull",
      "lang": "English (US)",
      "family": "Example",
      "style": "Regular",
      "familyname": fontName,
      "fontname": fontName + "-Regular",
      "fullname": fontName + " Regular"
    },
    "glyphs": glyphs,
    "sfnt_names": [
      [
        "English (US)",
        "Copyright",
        "Copyright (c) 2022 by koko"
      ],
      [
        "English (US)",
        "Family",
        fontName
      ]
    ],
    "input": ".",
    "output": [
      `./ttf/${userId}/${tmpId}/${fontName}.ttf`
    ],
    "# vim: set et sw=2 ts=2 sts=2:": false
  }
}


// main()

const neos = new Neos()
neos.on("friendAdded", (friend) => {
  if (friend.FriendStatus === "Requested") {
    neos.AddFriend(friend)
  }
})
neos.on("messageReceived", async (msg) => {
  try {
    const pmsg = JSON.parse(msg.Content)
    if (!pmsg.assetUri) {
      neos.SendTextMessage(msg.senderId, "Hi! I am FontGenerator!")
    } else {
      const data = await JsonUtil.decompress7zbson(pmsg.assetUri)
      const tmpId = (Math.floor(100000 + Math.random() * 900000))
      const userId = msg.SenderId
      await fs.mkdir(`./image/${userId}/${tmpId}`, {recursive: true})
      await fs.mkdir(`./svg/${userId}/${tmpId}`, {recursive: true})
      await fs.mkdir(`./trimed/${userId}/${tmpId}`, {recursive: true})
      await fs.mkdir(`./ttf/${userId}/${tmpId}`, {recursive: true})
      const fonts = data.Object.Children[0].Children[0].Children
      for (const slot of fonts) {
        const name = slot.Name.Data
        const url = "https://assets.neos.com/assets/" + slot.Components.Data[0].Data.URL.Data.replace("@neosdb:///", "").split(".")[0]
        const path = `./image/${userId}/${tmpId}/0x${name}.png`
        await downloadFile(url, path)
      }
      await sleep(1000)
      info("Download: OK")
      await generate(userId, tmpId)
      sendObjectMessage(neos, msg.SenderId, `https://genfont.neos.love/button.json?url=${userId}.${tmpId}`, "https://cdn.discordapp.com/attachments/938953464447369216/948045738225582110/custom_font2.png")

    }
  } catch (e) {
    error(e)
    neos.SendTextMessage(msg.SenderId, "問題が発生しました。")
  }
})

function downloadFile(url, path) {
  return new Promise((res, rej) => {
    const file = fsr.createWriteStream(path);
    const request = http.get(url, function (response) {
      response.pipe(file);
    });
    file.on('finish', function () {
      info("file download OK")
      file.close(() => res());
    });
  })
}

const sendObjectMessage = async (neos, userId, assetUri, thumbnailUri) => {
  const userMessages = await neos.GetUserMessages(userId);
  const message = new neos.CloudX.Shared.Message({
    messageType: "Object",
  });
  message.SetContent({
    assetUri,
    thumbnailUri,
  });
  const result = await userMessages.SendMessage(message);
  return result;
};

class JsonUtil {
  static async decompress7zbson(assetUrl) {
    const id = assetUrl.replace("neosdb:///", "").replace(".7zbson", "")
    const url = "https://decompress.kokoa.dev/?id="
    const {data} = await axios.get(url + id)
    return data
  }
}

const sleep = (time) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, time)
  })
}

neos.Login("FontGenerator", process.env.password)