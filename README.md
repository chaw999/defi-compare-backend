# DeFi OneKey Backend

NestJS 后端 API，用于获取和对比 DeFi 数据。

## 功能特性

- 🔗 **Zerion 数据源**: 从 Zerion API 获取 DeFi portfolio 和 positions 数据
- 📦 **预留数据源**: 可扩展的占位服务，方便后续接入其他数据源
- 🔄 **数据对比**: 对比两个地址或两个数据源的 DeFi 数据差异
- 📊 **统一格式**: 标准化的数据结构和 API 响应

## 技术栈

- **NestJS 10** - Node.js 框架
- **TypeScript** - 类型安全
- **Axios** - HTTP 客户端
- **@nestjs/config** - 环境变量管理

## 快速开始

### 1. 安装依赖

```bash
yarn install
```

### 2. 配置环境变量

确保在 `.env` 文件中设置：

```env
ZERION_API_KEY=your_zerion_api_key_here
PORT=8080
```

### 3. 启动开发服务器

```bash
yarn start:dev
```

服务将运行在 http://localhost:8080/api

## API 接口

### 获取地址 DeFi 数据

```
GET /api/address/:address
```

**参数**:
- `address`: 钱包地址

**响应**:
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "totalValueUSD": 12345.67,
    "positions": [...],
    "chains": ["ethereum", "polygon"],
    "lastUpdated": "2024-12-14T10:00:00.000Z",
    "source": "zerion"
  }
}
```

### 获取指定数据源的数据

```
GET /api/address/:address/source/:source
```

**参数**:
- `address`: 钱包地址
- `source`: 数据源 (`zerion` 或 `placeholder`)

### 对比两个地址

```
GET /api/compare?addressA=xxx&addressB=xxx
```

**参数**:
- `addressA`: 第一个地址
- `addressB`: 第二个地址

**响应**:
```json
{
  "success": true,
  "data": {
    "addressA": {...},
    "addressB": {...},
    "summary": {
      "totalValueDiffUSD": 1000,
      "totalValueDiffPercent": 5.5,
      "positionsOnlyInA": 2,
      "positionsOnlyInB": 1,
      "commonPositions": 5,
      "changedPositions": 3
    },
    "positionDiffs": [...]
  }
}
```

### 对比数据源差异

```
GET /api/compare/sources/:address
```

对比同一地址在 Zerion 和 Placeholder 数据源的差异。

### 健康检查

```
GET /api/health
```

## 项目结构

```
src/
├── common/
│   ├── dto/
│   │   └── response.dto.ts        # 统一响应格式
│   └── interfaces/
│       └── defi-data.interface.ts # 数据接口定义
├── defi/
│   ├── services/
│   │   ├── zerion.service.ts      # Zerion 数据源
│   │   ├── placeholder.service.ts # 预留数据源
│   │   └── compare.service.ts     # 对比服务
│   ├── defi.controller.ts         # API 控制器
│   └── defi.module.ts             # 模块定义
├── app.module.ts                  # 主模块
└── main.ts                        # 入口文件
```

## 扩展数据源

要实现新的数据源，只需：

1. 创建新的 Service 实现 `IDefiDataProvider` 接口
2. 在 `defi.module.ts` 中注册
3. 在 Controller 中添加路由

```typescript
import { IDefiDataProvider, AddressDefiData } from '../common/interfaces/defi-data.interface';

@Injectable()
export class MyCustomService implements IDefiDataProvider {
  readonly sourceName = 'custom';

  async getAddressDefiData(address: string): Promise<AddressDefiData> {
    // 实现数据获取逻辑
  }

  async getPortfolio(address: string): Promise<AddressDefiData> {
    return this.getAddressDefiData(address);
  }
}
```

## 常用命令

```bash
yarn start:dev    # 开发模式（热重载）
yarn start        # 生产模式
yarn build        # 构建
yarn lint         # 代码检查
```

## License

MIT

