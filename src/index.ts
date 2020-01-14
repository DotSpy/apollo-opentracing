import { Tracer } from '@opentelemetry/types';
import { RemoteGraphQLDataSource } from 'apollo-gateway-tracing';
import { Response} from 'apollo-server-env';
import { GraphQLRequestContext } from 'apollo-server-types';
import { ApolloError } from 'apollo-server-errors';
import { SpanKind, CanonicalCode } from '@opentelemetry/types';

export class OpentracingDataSource extends RemoteGraphQLDataSource {

  private tracer: Tracer;

  constructor(tracer: Tracer,
              config?: Partial<RemoteGraphQLDataSource> &
                  object &
                  ThisType<RemoteGraphQLDataSource>) {
    super(config);
    this.tracer = tracer;
  }

  willSendRequest<TContext>(requestContext: Pick<GraphQLRequestContext<TContext>, "request" | "context">): Promise<void> | void {
    const externalSpan = this.tracer.getCurrentSpan();
    this.tracer.startSpan('graphql-request', {
      parent: externalSpan,
      kind: SpanKind.CLIENT,
      attributes: {
        query: requestContext.request.query,
      },
    });
  }

  parseBody(response: Response): Promise<object | string> {
    let currentSpan = this.tracer.getCurrentSpan();
    if (currentSpan) {
      currentSpan.end()
    }
    return super.parseBody(response);
  }

  errorFromResponse(response: Response): Promise<ApolloError> {
    let currentSpan = this.tracer.getCurrentSpan();
    if (currentSpan) {
      switch (response.status) {
        case 404:
          currentSpan.setStatus({ code: CanonicalCode.NOT_FOUND });
          break;
        case 401:
          currentSpan.setStatus({ code: CanonicalCode.UNAUTHENTICATED });
          break;
        case 403:
          currentSpan.setStatus({ code: CanonicalCode.PERMISSION_DENIED });
          break;
        case 429:
          currentSpan.setStatus({ code: CanonicalCode.RESOURCE_EXHAUSTED });
          break;
        case 412:
          currentSpan.setStatus({ code: CanonicalCode.FAILED_PRECONDITION });
          break;
        case 500:
          currentSpan.setStatus({ code: CanonicalCode.INTERNAL });
          break;
        case 503:
          currentSpan.setStatus({ code: CanonicalCode.UNAVAILABLE });
          break;
        default:
          currentSpan.setStatus({ code: CanonicalCode.UNKNOWN });
          break;
      }
      currentSpan.end()
    }
    return super.errorFromResponse(response);
  }

}