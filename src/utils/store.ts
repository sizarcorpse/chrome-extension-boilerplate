import { v4 as uuidv4 } from "uuid";
import { ZodSchema } from "zod";

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
    [key: string]: string;
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
      [key: string]: string;
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
}
