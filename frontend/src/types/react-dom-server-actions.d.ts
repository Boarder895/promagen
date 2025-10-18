// Temporary shim so TS understands the server-actions hooks on React 18 types.
// Remove once your React/Next types natively include these signatures.

declare module "react-dom" {
  export function useFormState<S, R>(
    action: (state: S, formData: FormData) => Promise<R> | R,
    initialState: S,
    permalink?: string
  ): [R, (payload: FormData) => void];

  export function useFormStatus(): { pending: boolean };
}






