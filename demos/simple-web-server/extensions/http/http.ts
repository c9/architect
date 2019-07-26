
import express from 'express';
import * as core from 'express-serve-static-core';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import { ArchetypedExtension, ExtensionConfig } from '../../../../archetyped/lib';

export default class Http extends ArchetypedExtension {

  private readonly app: core.Express;
  private readonly host: string;
  private readonly port: number;

  constructor(config: ExtensionConfig, imports: any) {
    super(config, imports);
    this.host = config.host || 'localhost';
    this.port = config.port || 4000;
    this.app = express();
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: false }));

    this.register('http', this);
  }

  get(route: string, ...handlers: express.RequestHandler[]) {
    this.app.get(route, handlers);
  }

  post(route: string, ...handlers: express.RequestHandler[]) {
    this.app.post(route, handlers);
  }

  put(route: string, ...handlers: express.RequestHandler[]) {
    this.app.put(route, handlers);
  }

  delete(route: string, ...handlers: express.RequestHandler[]) {
    this.app.delete(route, handlers);
  }

  use(...handlers: express.RequestHandler[]) {
    this.app.use(...handlers);
  }

  onAppReady(callback?: Function) {
    this.app.get('/*', (req: core.Request, res: core.Response) => {
      res.sendFile(path.resolve(__dirname, './index.html'));
    });
    this.app.listen(this.port, () => {
      console.log(`HTTP server listening on http://${this.host}:${this.port}`);
      if (callback) callback();
    });
  }
}
