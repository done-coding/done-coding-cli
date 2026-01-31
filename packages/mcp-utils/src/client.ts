import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** mcp客户端创建选项 */
export interface McpClientCreateOptions {
  /** 客户端名称 */
  name: string;
  /** 客户端版本 */
  version: string;
  /** 传输参数 */
  transportParams: StdioServerParameters;
}

/** mcp连接状态 */
export enum McpConnectStatusEnum {
  /** 未连接 */
  DISCONNECTED = "disconnected",
  /** 连接中 */
  CONNECTING = "connecting",
  /** 已连接 */
  CONNECTED = "connected",
}

/** 传输通道作用域 */
export class TransportScoped {
  /** 创建传输通道作用域 */
  public static create(client: Client, transportParams: StdioServerParameters) {
    return new TransportScoped(client, transportParams);
  }

  /** 连接状态 */
  private statusRaw = McpConnectStatusEnum.DISCONNECTED;

  /** 传输通道 */
  private transportRaw: StdioClientTransport | undefined;

  /** 连接共享Promise */
  private connectPromiseShared: Promise<void> | undefined;

  private constructor(
    public readonly client: Client,
    public readonly transportParams: StdioServerParameters,
  ) {}

  /** 连接状态 */
  public get status(): McpConnectStatusEnum {
    return this.statusRaw;
  }

  /** 关闭 */
  public close() {
    if (!this.transportRaw) {
      return;
    }
    this.transportRaw.close();
    this.changeStatus(McpConnectStatusEnum.DISCONNECTED);
  }

  /** 连接 */
  public async connect() {
    if (this.status === McpConnectStatusEnum.CONNECTED) {
      return;
    }
    if (this.connectPromiseShared) {
      return this.connectPromiseShared;
    }

    // 保证传输通道存在
    if (!this.transportRaw) {
      this.transportRaw = this.createTransport();
    }

    /** 当前传输通道 */
    const currentTransport = this.transportRaw;

    // eslint-disable-next-line no-async-promise-executor
    this.connectPromiseShared = new Promise(async (resolve, reject) => {
      try {
        this.changeStatus(McpConnectStatusEnum.CONNECTING);
        await this.client.connect(currentTransport);

        // 保证传输通道未被替换
        if (currentTransport === this.transportRaw) {
          this.changeStatus(McpConnectStatusEnum.CONNECTED);
          resolve();
        } else {
          this.changeStatus(McpConnectStatusEnum.DISCONNECTED);
          resolve(this.connect());
        }
      } catch (error) {
        this.changeStatus(McpConnectStatusEnum.DISCONNECTED);
        reject(error);
      } finally {
        this.connectPromiseShared = undefined;
      }
    });
    return this.connectPromiseShared;
  }

  /** 更改状态 */
  private changeStatus = (status: McpConnectStatusEnum) => {
    this.statusRaw = status;
    if (status === McpConnectStatusEnum.DISCONNECTED) {
      this.transportRaw = undefined;
    }
  };

  /** 创建传输通道 */
  private createTransport = () => {
    const transport = new StdioClientTransport(this.transportParams);
    transport.onclose = () => {
      this.changeStatus(McpConnectStatusEnum.DISCONNECTED);
      this.client.close();
    };
    return transport;
  };
}

/** 创建MCP客户端作用域选项 */
export interface CreateClientScopedOptions {
  /** 客户端名称 */
  name: string;
  /** 客户端版本 */
  version: string;
  /** 传输参数 */
  transportParams: StdioServerParameters;
}

/** MCP客户端作用域 */
export class ClientScoped {
  /** 实例Map */
  public static readonly instanceMap = new Map<string, ClientScoped>();

  /** 创建客户端作用域 */
  public static create(options: CreateClientScopedOptions) {
    const clientKey = this.getClientKey(options);
    if (this.instanceMap.has(clientKey)) {
      return this.instanceMap.get(clientKey)!;
    } else {
      return new ClientScoped(options);
    }
  }

  private static getClientKey(options: CreateClientScopedOptions) {
    return `${options.name}@${options.version} ${JSON.stringify(options.transportParams)}`;
  }

  /** 客户端缓存Key */
  private clientKey: string;

  /** 客户端 */
  private client: Client;

  /** 传输通道作用域 */
  private transportScoped: TransportScoped;

  private constructor(public readonly options: CreateClientScopedOptions) {
    this.clientKey = ClientScoped.getClientKey(options);

    this.client = new Client({
      name: options.name,
      version: options.version,
    });

    this.client.onclose = () => {
      this.close();
    };

    this.transportScoped = TransportScoped.create(
      this.client,
      options.transportParams,
    );

    this.instanceMap.set(this.clientKey, this);
  }

  /** 实例Map */
  private get instanceMap() {
    return ClientScoped.instanceMap;
  }

  /** 关闭 */
  public close = () => {
    if (!this.instanceMap.has(this.clientKey)) {
      return;
    }
    this.client.close();
    this.transportScoped.close();
    this.instanceMap.delete(this.clientKey);
  };

  /** 调用工具 */
  public callTool = async (...args: Parameters<Client["callTool"]>) => {
    await this.transportScoped.connect();
    return this.client.callTool(...args);
  };

  /** 读取资源 */
  public readResource = async (...args: Parameters<Client["readResource"]>) => {
    await this.transportScoped.connect();
    return this.client.readResource(...args);
  };

  /** 获取提示词 */
  public getPrompt = async (...args: Parameters<Client["getPrompt"]>) => {
    await this.transportScoped.connect();
    return this.client.getPrompt(...args);
  };

  /** 设置日志级别 */
  public setLoggingLevel = async (
    ...args: Parameters<Client["setLoggingLevel"]>
  ) => {
    await this.transportScoped.connect();
    return this.client.setLoggingLevel(...args);
  };

  /** 获取服务能力 */
  public getServerCapabilities = async (
    ...args: Parameters<Client["getServerCapabilities"]>
  ) => {
    await this.transportScoped.connect();
    return this.client.getServerCapabilities(...args);
  };

  /** 列出工具 */
  public listTools = async (...args: Parameters<Client["listTools"]>) => {
    await this.transportScoped.connect();
    return this.client.listTools(...args);
  };

  /** 列出资源 */
  public listResources = async (
    ...args: Parameters<Client["listResources"]>
  ) => {
    await this.transportScoped.connect();
    return this.client.listResources(...args);
  };

  /** 列出提示词 */
  public listPrompts = async (...args: Parameters<Client["listPrompts"]>) => {
    await this.transportScoped.connect();
    return this.client.listPrompts(...args);
  };

  /** 心跳 */
  public ping = async (...args: Parameters<Client["ping"]>) => {
    await this.transportScoped.connect();
    return this.client.ping(...args);
  };
}

/** 创建客户端作用域 */
export const createClientScoped = (options: CreateClientScopedOptions) => {
  return ClientScoped.create(options);
};
