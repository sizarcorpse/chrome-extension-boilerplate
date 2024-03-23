import { v4 as uuidv4 } from "uuid";
import { ZodSchema, z } from "zod";

export type Response<T> = {
  data: T | null;
  count?: number | null;
  status: "ok" | "error" | "unauthorized" | "unauthenticated";
  errors?:
    | "not-found"
    | "server-error"
    | "network-error"
    | "validation-error"
    | "bad-request"
    | "data-exists"
    | "unknown-error";
  message?: string;
};

export type BaseDocument = {
  [key: string]: any;
  _id: string;
  _createdAt: string;
  _updatedAt: string;
};

export type Document<T> = T & BaseDocument;

export type Documents<T> = Document<T>[];

type DirectComparison<T> = {
  [K in keyof T]?: T[K] | { $gt?: T[K]; $lt?: T[K]; $eq?: T[K] };
};

type OperatorComparison<T> = {
  [K in keyof T]?: { $gt?: T[K]; $lt?: T[K]; $eq?: T[K] };
};

type InnerCondition<T> = DirectComparison<T> & OperatorComparison<T>;

type LogicalOperation<T> = {
  $or?: InnerCondition<T>[];
  $and?: InnerCondition<T>[];
  $not?: InnerCondition<T>[];
};

type QueryCondition<T> = InnerCondition<T> &
  LogicalOperation<T> & { [key: string]: any };

export class Collection<T> {
  private schema: ZodSchema<T>;
  private collectionKey: string;

  constructor(collectionKey: string, schema: ZodSchema<T>) {
    if (!collectionKey) {
      throw new Error("A database name is required.");
    }

    if (typeof collectionKey !== "string" || collectionKey.length <= 3) {
      throw new Error(
        "The database name must be a string and have more than 3 characters."
      );
    }

    if (schema && !(schema instanceof ZodSchema)) {
      throw new Error("The schema argument must be an instance of Schema");
    }

    this.schema = schema;
    this.collectionKey = collectionKey;
    this.createCollection();
  }

  static set = <T>(key: string, value: T): Promise<void> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  };

  static get = <T>(key: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key]);
        }
      });
    });
  };

  static match = <T>(
    document: Document<T>,
    condition: QueryCondition<T>
  ): boolean => {
    for (let field in condition) {
      if (field.startsWith("$")) {
        switch (field) {
          case "$or":
            if (
              !(condition[field] as QueryCondition<T>[]).some((cond: any) =>
                this.match(document, cond)
              )
            ) {
              return false;
            }
            break;
          case "$and":
            if (
              !(condition[field] as QueryCondition<T>[]).every((cond: any) =>
                this.match(document, cond)
              )
            ) {
              return false;
            }
            break;
          case "$not":
            if (Array.isArray(condition[field])) {
              if (
                (condition[field] as QueryCondition<T>[]).some((cond: any) =>
                  this.match(document, cond)
                )
              ) {
                return false;
              }
            } else {
              if (this.match(document, condition[field] as any)) {
                return false;
              }
            }
            break;
        }
      } else if (
        typeof condition[field] === "object" &&
        condition[field] !== null
      ) {
        for (let operator in condition[field]) {
          switch (operator) {
            case "$gt":
              if ((document[field] as any) <= condition[field][operator]) {
                return false;
              }
              break;
            case "$lt":
              if ((document[field] as any) >= condition[field][operator]) {
                return false;
              }
              break;
            case "$eq":
              if (document[field] !== condition[field][operator]) {
                return false;
              }
              break;
          }
        }
      } else {
        if (document[field] !== condition[field]) {
          return false;
        }
      }
    }

    return true;
  };

  createCollection = async (): Promise<void> => {
    try {
      const collection = await chrome.storage.local.get(this.collectionKey);
      if (!collection[this.collectionKey]) {
        const newCollection = { [this.collectionKey]: [] };
        await chrome.storage.local.set(newCollection);
      }
    } catch (error: any) {
      throw new Error(error);
    }
  };

  create = async (data: T): Promise<Response<Document<T>>> => {
    try {
      if (!data) {
        return {
          data: null,
          status: "error",
          message: "Data is required",
          errors: "bad-request",
        };
      }

      const validate = this.schema.safeParse(data);
      if (!validate.success)
        throw new Error(
          validate.error.issues.map((issue: any) => issue.message).join(", ")
        );

      const _id = uuidv4();
      const _createdAt = new Date().toISOString();
      const _updatedAt = _createdAt;

      const transformed = {
        ...validate.data,
        _id,
        _createdAt,
        _updatedAt,
      };
      const state: Documents<T> = await Collection.get(this.collectionKey);
      state.push(transformed);

      await Collection.set(this.collectionKey, state);

      return {
        data: transformed,
        count: 1,
        status: "ok",
        message: "Document created successfully.",
      };
    } catch (error: any) {
      return {
        data: null,
        status: "error",
        message: error.message,
      };
    }
  };

  read = async (query: {
    [K in keyof Document<T>]?: string;
  }): Promise<Response<Document<T>>> => {
    try {
      const state: Documents<T> = await Collection.get(this.collectionKey);

      const result = state.find((item) =>
        Object.entries(query).every(([key, value]) => item[key] === value)
      );

      if (!result) {
        return {
          data: null,
          status: "error",
          message: "Document not found.",
          errors: "not-found",
        };
      } else {
        return {
          data: result,
          count: 1,
          status: "ok",
          message: "Document retrieved successfully.",
        };
      }
    } catch (error: any) {
      return {
        data: null,
        status: "error",
        message: error.message,
      };
    }
  };

  update = async (
    query: {
      [K in keyof Document<T>]?: string;
    },
    data: Partial<T>
  ): Promise<Response<Document<T>>> => {
    try {
      const state: Documents<T> = await Collection.get(this.collectionKey);

      const index = state.findIndex((item) =>
        Object.entries(query).every(([key, value]) => item[key] === value)
      );

      if (index === -1) {
        return {
          data: null,
          status: "error",
          message: "Document not found.",
          errors: "not-found",
        };
      }

      // TODO: Validate the data before updating using .partial()

      const _updatedAt = new Date().toISOString();
      const transformed = {
        ...data,
        _updatedAt,
      };

      state[index] = {
        ...state[index],
        ...transformed,
      };

      await Collection.set(this.collectionKey, state);

      return {
        data: state[index],
        count: 1,
        status: "ok",
        message: "Document updated successfully.",
      };
    } catch (error: any) {
      return {
        data: null,
        status: "error",
        message: error.message,
      };
    }
  };

  remove = async (query: {
    [key: string]: string;
  }): Promise<Response<Document<T>>> => {
    try {
      const state: Documents<T> = await Collection.get(this.collectionKey);

      const index = state.findIndex((item) =>
        Object.entries(query).every(([key, value]) => item[key] === value)
      );

      if (index === -1) {
        return {
          data: null,
          status: "error",
          message: "Document not found.",
          errors: "not-found",
        };
      }

      const deleted = state[index];

      state.splice(index, 1);

      await Collection.set(this.collectionKey, state);

      return {
        data: deleted,
        status: "ok",
        message: "Document removed successfully.",
      };
    } catch (error: any) {
      return {
        data: null,
        status: "error",
        message: error.message,
      };
    }
  };

  createMany = async (data: T[]): Promise<Response<Documents<T>>> => {
    try {
      if (!data) {
        return {
          data: [],
          status: "error",
          message: "Data is required",
          errors: "bad-request",
        };
      }

      const validate = this.schema.array().safeParse(data);
      if (!validate.success)
        throw new Error(
          validate.error.issues.map((issue: any) => issue.message).join(", ")
        );

      const _createdAt = new Date().toISOString();
      const _updatedAt = _createdAt;

      const transformed = validate.data.map((item) => ({
        ...item,
        _id: uuidv4(),
        _createdAt,
        _updatedAt,
      }));

      const state: Documents<T> = await Collection.get(this.collectionKey);
      state.push(...transformed);

      await Collection.set(this.collectionKey, state);

      return {
        data: transformed,
        count: transformed.length,
        status: "ok",
        message: "Documents created successfully.",
      };
    } catch (error: any) {
      return {
        data: [],
        status: "error",
        message: error.message,
      };
    }
  };

  readMany = async (queries: {
    where?: QueryCondition<T> | QueryCondition<T>[];
    orderBy?: {
      [K in keyof Document<T>]?: "asc" | "desc";
    };
    limit?: number;
    skip?: number;
  }): Promise<Response<Documents<T>>> => {
    try {
      let state: Documents<T> = await Collection.get(this.collectionKey);
      let result: Documents<T> = [];

      if (queries && queries.where) {
        let { where, orderBy, limit, skip } = queries;
        let _limit = limit || 10;
        let _skip = skip || 0;

        if (where) {
          if (!Array.isArray(where)) {
            where = [where];
          }

          result = state.filter((document) =>
            where.some((condition: any) =>
              Collection.match(document, condition)
            )
          );
        }

        if (orderBy) {
          result = result.sort((a, b) =>
            Object.entries(orderBy).reduce((acc, [key, order]) => {
              if (acc !== 0) return acc;
              if (a[key] < b[key]) return order === "asc" ? -1 : 1;
              if (a[key] > b[key]) return order === "asc" ? 1 : -1;
              return 0;
            }, 0)
          );
        }
        if (
          limit !== undefined ||
          _skip !== undefined ||
          _limit !== undefined
        ) {
          result = result.slice(_skip, limit ? _skip + limit : _skip + _limit);
        }

        return {
          data: result,
          count: result.length,
          status: "ok",
          message: "Documents retrieved successfully.",
        };
      }

      return {
        data: state,
        count: state.length,
        status: "ok",
        message: "Documents retrieved successfully.",
      };
    } catch (error: any) {
      return {
        data: [],
        status: "error",
        message: error.message,
      };
    }
  };
}

const userSchema = z.object({
  username: z.string(),
  role: z.enum(["admin", "user"]),
  posted: z.number(),
  verified: z.boolean(),
});

type UserType = z.infer<typeof userSchema>;

export const userCollection = new Collection<UserType>("users", userSchema);
