import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  globalLoader,
  LoaderOptions,
  LoaderState,
} from "../services/loader/globalLoaderService";

interface GlobalLoaderContextValue extends LoaderState {
  showLoader: (message?: string, options?: LoaderOptions) => () => void;
  hideLoader: () => void;
  withLoader: <T>(
    promise: Promise<T>,
    message?: string,
    options?: LoaderOptions,
  ) => Promise<T>;
}

const GlobalLoaderContext = createContext<GlobalLoaderContextValue | null>(null);

export const GlobalLoaderProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<LoaderState>(globalLoader.getState());

  useEffect(() => {
    return globalLoader.subscribe(setState);
  }, []);

  const showLoader = useCallback((message?: string, options?: LoaderOptions) => {
    return globalLoader.startRequest({
      message,
      blocking: options?.blocking,
    });
  }, []);

  const hideLoader = useCallback(() => {
    globalLoader.hide();
  }, []);

  const withLoader = useCallback(
    async <T,>(
      promise: Promise<T>,
      message?: string,
      options?: LoaderOptions,
    ): Promise<T> => {
      const stop = globalLoader.startRequest({
        message,
        blocking: options?.blocking,
      });
      try {
        return await promise;
      } finally {
        stop();
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      ...state,
      showLoader,
      hideLoader,
      withLoader,
    }),
    [state, showLoader, hideLoader, withLoader],
  );

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
    </GlobalLoaderContext.Provider>
  );
};

export const useGlobalLoader = (): GlobalLoaderContextValue => {
  const context = useContext(GlobalLoaderContext);
  if (!context) {
    throw new Error("useGlobalLoader must be used within GlobalLoaderProvider");
  }
  return context;
};
