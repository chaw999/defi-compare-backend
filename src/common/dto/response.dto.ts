/**
 * 统一 API 响应格式
 */
export class ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;

  constructor(data?: T, error?: string, message?: string) {
    this.success = !error;
    this.data = data;
    this.error = error;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data: T, message?: string): ApiResponse<T> {
    return new ApiResponse(data, undefined, message);
  }

  static error<T>(error: string, message?: string): ApiResponse<T> {
    return new ApiResponse<T>(undefined, error, message);
  }
}

