import { createServer, Server } from "http";
import body from "body-parser";
import express, { Application, Request } from "express";
import getPort from "get-port";
import { JsonObject } from "type-fest";

export const MOCK_API_KEY = "mock-api-key";

type CapturedRequest = Pick<Request, "headers" | "method" | "body">;

type Context = {
  server: Application;
  nodeServer: Server;
  url: string;
  /**
   * Setup a response that will be sent to requests
   */
  res: <S extends MockSpec>(spec?: S) => MockResult<S>;
};

type MockSpec = {
  headers?: Record<string, string>;
  body?: {
    data?: JsonObject;
    extensions?: JsonObject;
    errors?: JsonObject;
  };
};

type MockResult<Spec extends MockSpec> = {
  spec: Spec;
  requests: {
    method: string;
    headers: Record<string, string>;
    body: JsonObject;
  }[];
};

export function setupTestServer(): Context {
  const ctx = {} as Context;

  beforeAll(async done => {
    const port = await getPort();
    ctx.server = express();
    ctx.server.use(body.json());
    ctx.nodeServer = createServer();
    ctx.nodeServer.listen({ port });
    ctx.nodeServer.on("request", ctx.server);
    ctx.nodeServer.once("listening", done);
    ctx.url = `http://localhost:${port}`;

    ctx.res = spec => {
      const requests: CapturedRequest[] = [];
      ctx.server.use("*", function mock(req, res) {
        if (req.headers.authorization !== MOCK_API_KEY) {
          res.sendStatus(401);
        } else {
          req.headers.host = "DYNAMIC";
          requests.push({
            method: req.method,
            headers: req.headers,
            body: req.body,
          });
          if (spec?.headers) {
            Object.entries(spec.headers).forEach(([name, value]) => {
              res.setHeader(name, value);
            });
          }
          res.send(spec?.body ?? { data: {} });
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { spec, requests: requests } as any;
    };
  });

  afterEach(() => {
    // https://stackoverflow.com/questions/10378690/remove-route-mappings-in-nodejs-express/28369539#28369539
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.server._router.stack.forEach((item: any, i: number) => {
      if (item.name === "mock") {
        ctx.server._router.stack.splice(i, 1);
      }
    });
  });

  afterAll(done => {
    ctx.nodeServer.close(done);
  });

  return ctx;
}
