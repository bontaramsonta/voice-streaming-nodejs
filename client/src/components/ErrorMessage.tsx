import { AlertCircle } from "lucide-react";

interface ErrorMessageProps {
  message?: string;
}

export default function ErrorMessage({
  message = "Missing conversation ID",
}: ErrorMessageProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-2xs max-w-sm w-full">
      <div className="flex">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center px-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-semibold text-gray-900">Error</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
