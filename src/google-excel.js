const fs = require('fs')
const {google} = require('googleapis')
const express = require('express')
const fetch = require('node-fetch')
const opn = require('open')
const { URLSearchParams } = require('url')

const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly']
/**
 * 把下載的json檔放進來
 */
const config = {
  file: `secret.json`,
  clientId: ``,
  clientSecret: ``,
  redirectUris: ``,
  refreshToken: `` 
}

let content = fs.readFileSync(config.file)
content = JSON.parse(content)
content = content.web

// Create an oAuth2 client to authorize the API call
/**
 * 從json檔裡取得oauth2所需要的client_id、client_secret、redirect_uris
 */
const client = new google.auth.OAuth2(
  content.client_id,
  content.client_secret,
  content.redirect_uris[0]
)

config.clientId = content.client_id
config.clientSecret = content.client_secret
config.redirectUris = content.redirect_uris[0]

// Generate the url that will be used for authorization
// 第一次要打開瀏覽器來取得授權跟拿token
// access_type: 'offline'是為了拿refresh token
this.authorizeUrl = client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes
})

const app = express()

/**
 * 第一步，打開server並開啟瀏覽器拿授權
 */
const server = app.listen(3000, async () => {
  console.log('listening')
  // 取得token後，以後打開瀏覽器就可以註解了
  // opn(this.authorizeUrl)
})

/**
 * 第二步，前端登入＆授權後，google會自己call redirect_uris的網址，來到我們定義的/oauth2callback api
 * 並且後面會自動帶入有code的query
 * 我們要透過這個code來拿access token跟refresh token
 * 這裡的refresh token要記住，以後再也拿不到了
 * 換新的access token時，就一直拿這個refresh token來更新
 */
app.get('/oauth2callback', async (req, res) => {
  console.log('來到oauthcallback了');
  const code = req.query.code
  if (!code) throw new Error('沒有拿到code哦')
  
  const {tokens} = await client.getToken(code)
  console.log(tokens);
  
  /**
   * tokens = {
   *    access_token: <access_token>,
   *    refresh_token: <refresh_token>,
   *    scope: <scope>,
   *    token_type: 'Bearer',
   *    expiry_date: <expiry_date>,
   * }
   */
  client.credentials = tokens
  // token可以存到ＤＢ去，這裡先放到config裡
  config.refreshToken = tokens.refresh_token

  // 告訴前端成功了，叫他去call /autologin api
  
  // 或是想幹嘛都可以
  // 接下來可以去call sheet的api了
  // const sheetData = await getSheetData(client)
  // console.log('sheetData');
  // console.log(sheetData);
})

/**
 *  第三步，這邊已經成功獲取oauth2的授權了，因此可以讓前端call api來做任何事
 *  如果沒有從瀏覽器拿到token的話，就到ＤＢ拿refresh token去取得新的access token
 *  再把token放到client obj裡，就能call google的api了
 */
app.get('/autologin', async (req, res) => {
  const refreshToken = config.refreshToken
  const tokens = await _getAccessToken(refreshToken)
  client.credentials = tokens
  const sheetData = await getSheetData(client)
  console.log('sheetData');
  console.log(sheetData);
})

async function _getAccessToken(refreshToken) {
  const params = new URLSearchParams()
  params.append('client_id', config.clientId)
  params.append('client_secret', config.clientSecret)
  params.append('refresh_token', refreshToken)
  params.append('grant_type', 'refresh_token')
  let tokens = await fetch(`https://www.googleapis.com/oauth2/v4/token`, {
    body: params,
    method: 'POST'
  })
  tokens = await tokens.json()
  return tokens
}

async function getSheetData(auth) {
  const sheets = google.sheets('v4')
  let data = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: '',  // 輸入想要撈取的google excel id
    range: 'A:F',  // 輸入這個excel想要撈的欄位
  })
  data = data.data.values
  return data
}
