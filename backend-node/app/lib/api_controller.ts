import { Controller } from 'egg';
import { error, success } from './response';

type ApiOperation<T> = () => Promise<T>;

export class ApiController extends Controller {
  protected parseId(param = 'id'): number | null {
    const id = Number(this.ctx.params[param]);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  protected async respond<T>(operation: ApiOperation<T>): Promise<void> {
    try {
      success(this.ctx, await operation());
    } catch (cause) {
      error(this.ctx, cause instanceof Error ? cause.message : 'unknown error');
    }
  }
}
