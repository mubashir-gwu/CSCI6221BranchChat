import ApiKeyList from "@/components/settings/ApiKeyList";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold mb-6">API Key Settings</h1>
      <ApiKeyList />
    </div>
  );
}
