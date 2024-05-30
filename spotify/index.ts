import { createServer } from "http";
import { request } from "undici";
import querystring from "querystring";

import { CurrentlyPlaying } from "./interfaces/CurrentlyPlaying";
import { writeFileSync } from "fs";
import terminalImage from "terminal-image";
import path from "path";

interface SpotifyConfig {
  id: string,
  secret: string,
  port: number
}

const DEFAULT_PORT = 4381;

export class SpotifyAPI {
  public config: SpotifyConfig;

  public auth_url: string;

  public auth_code: string | null = null;
  public refresh_token: string | null = null;
  public access_token: string | null = null;

  constructor(config: SpotifyConfig) {
    this.config = config;

    if (!this.config.port) this.config.port = DEFAULT_PORT;
    this.auth_url = `https://accounts.spotify.com/authorize?client_id=${this.config.id}&response_type=code&redirect_uri=http://localhost:${this.config.port}&scope=user-read-currently-playing`;
  }

  authorize(): Promise<string> {
    console.log("Please open the following url to authorize.\n" + this.auth_url!);
    return new Promise<string>((resolve, reject) => {
      const server = createServer((req, res) => {
        res.write("Verified.");
        server.closeAllConnections();
        server.unref();
        this.auth_code = req.url?.slice(7)!;
        console.log("Authorization Code: " + this.auth_code);
        resolve(this.auth_code);
      });
      server.listen(this.config.port);
    });
  }
  async getRefreshToken(): Promise<string> {
    const basicAuth = Buffer.from(`${this.config.id}:${this.config.secret}`).toString('base64');
    const res = await request("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: querystring.stringify({
        grant_type: "authorization_code",
        code: this.auth_code,
        redirect_uri: `http://localhost:${this.config.port}`
      })
    });
    // @ts-ignore
    this.refresh_token = (await res.body.json())["refresh_token"] as string;
    console.log("Refresh Token: " + this.refresh_token);
    return this.refresh_token;
  }
  async getAccessToken(): Promise<string> {
    const basicAuth = Buffer.from(`${this.config.id}:${this.config.secret}`).toString('base64');
    const res = await request("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: querystring.stringify({
        grant_type: "refresh_token",
        refresh_token: this.refresh_token
      })
    });
    // @ts-ignore
    this.access_token = (await res.body.json())["access_token"] as string;
    console.log("Access Token: " + this.access_token);
    return this.access_token;
  }
  async getNowPlaying(): Promise<CurrentlyPlaying> {
    const res = await request("https://api.spotify.com/v1/me/player/currently-playing", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.access_token}`
      }
    });
    
    const data = (await res.body.json()) as CurrentlyPlaying;
    console.log("Currently Playing: ", data);
    return data;
  }
}

const api = new SpotifyAPI({
  id: "e16ba747847f4705b3f162645e6d6f14",
  secret: "648b8f2568924b86b5ad18925413951b",
  port: 3000
});

await api.authorize();
await api.getRefreshToken();
await api.getAccessToken();
const current = await api.getNowPlaying();


const buf = await (await request(current.item.album.images[2].url)).body.arrayBuffer();

console.log(await terminalImage.buffer(Buffer.from(buf), {
}));