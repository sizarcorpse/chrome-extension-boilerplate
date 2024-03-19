type FindElement = (
  selector: string,
  parent?: Element | Document
) => Element | null;

export const findElement: FindElement = (selector, parent = document) => {
  try {
    if (typeof selector !== "string") {
      throw new Error("Selector must be a string");
    }

    const element = parent.querySelector(selector);
    return element;
  } catch (error) {
    console.error(`Error finding element:${selector}`, error);
    return null;
  }
};

type FindElements = (
  selector: string,
  parent?: Element | Document
) => Element[];

export const findElements: FindElements = (selector, parent = document) => {
  try {
    if (typeof selector !== "string") {
      throw new Error("Selector must be a string");
    }
    const elements = Array.from(parent.querySelectorAll(selector));

    return elements;
  } catch (error) {
    console.error(`Error finding elements:${selector}`, error);
    return [];
  }
};

type CreateElement = (
  type: keyof JSX.IntrinsicElements,
  options?: {
    [key: string]: string | undefined;
    class?: string;
    text?: string;
  }
) => HTMLElement | null;

export const createElement: CreateElement = (type, options = {}) => {
  let element: HTMLElement;

  try {
    if (typeof type !== "string") {
      throw new Error("Type must be a string");
    }

    element = document.createElement(type);

    Object.entries(options).forEach(([key, value]) => {
      if (typeof value !== "string") {
        throw new Error(`Option "${key}" must be a string`);
      }

      if (key === "class") {
        element.classList.add(...value.split(" "));
        return;
      }

      if (key === "text") {
        element.appendChild(document.createTextNode(value));
        return;
      }

      element.setAttribute(key, value);
    });

    return element;
  } catch {
    console.error(`Error creating element:${type}`);
    return null;
  }
};

type WaitForElement = (
  selector: string,
  runInterval?: number,
  endInterval?: number
) => Promise<Element | null>;

export const waitForElement: WaitForElement = async (
  selector: string,
  runInterval = 200,
  endInterval = 10000
) => {
  try {
    const checkElement = async (): Promise<Element | null> => {
      let elapsed = 0;

      while (elapsed < endInterval) {
        const element = document.querySelector(selector);

        if (element) {
          return element;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, runInterval);
        });
        elapsed += runInterval;
      }
      throw new Error(`Element matching selector "${selector}" not found.`);
    };

    return await checkElement();
  } catch (error) {
    console.error("Error waiting for element:", error);
    return null;
  }
};

type SetAttributes = (
  element: Element | HTMLElement | SVGElement,
  attributes: { [key: string]: string }
) => void;

export const setAttributes: SetAttributes = (element, attributes) => {
  try {
    Object.entries(attributes).forEach(([key, value]) => {
      if (typeof value !== "string") {
        throw new Error(`Attribute "${key}" must be a string`);
      }

      element.setAttribute(key, value);
    });
  } catch (error) {
    console.error("Error setting attributes:", error);
  }
};

type HasClass = (
  element: Element,
  classNames: string | string[],
  mode?: "every" | "some"
) => boolean;

export const hasClass: HasClass = (element, classNames, mode = "some") => {
  try {
    if (Array.isArray(classNames)) {
      return mode === "every"
        ? classNames.every((className) => element.classList.contains(className))
        : classNames.some((className) => element.classList.contains(className));
    } else {
      return element.classList.contains(classNames);
    }
  } catch (error) {
    console.error(
      `Error checking class for "${classNames}" with mode "${mode}":`,
      error
    );
    return false;
  }
};

type AppendElement = (
  parent: string | Element | HTMLElement,
  child: Node | HTMLElement,
  position?: "before" | "after",
  reference?: number | string | Element | HTMLElement
) => void;

export const appendElement: AppendElement = (
  parent,
  child,
  position = "after",
  reference = 0
) => {
  try {
    const parentElement =
      typeof parent === "string" ? findElement(parent) : parent;

    if (!parentElement) {
      throw new Error("Parent element not found");
    }

    let referenceElement: ChildNode | null = null;

    if (typeof reference === "number") {
      referenceElement = parentElement.children[reference];
    } else if (typeof reference === "string") {
      referenceElement = parentElement.querySelector(reference);
    } else if (reference instanceof Element) {
      referenceElement = reference;
    }

    if (position === "before") {
      parentElement.insertBefore(child, referenceElement);
    } else {
      if (referenceElement && referenceElement.nextSibling) {
        parentElement.insertBefore(child, referenceElement.nextSibling);
      } else {
        parentElement.appendChild(child);
      }
    }
  } catch (error) {
    console.error("Error appending element:", error);
  }
};
