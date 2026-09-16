using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace SandShark.ProcessAudioCapture;

internal static class WindowCaptureSources
{
    private sealed record Source(string id, string name, uint processId);

    public static int Run(string[] args)
    {
        try
        {
            if (args.Length == 1 && args[0] == "--list-minimized-windows")
            {
                var sources = new List<Source>();
                if (!EnumWindows((window, _) =>
                {
                    if (!IsIconic(window) || !IsApplicationWindow(window)) return true;
                    var title = new StringBuilder(512);
                    if (GetWindowText(window, title, title.Capacity) == 0) return true;
                    GetWindowThreadProcessId(window, out var processId);
                    if (processId != 0)
                        sources.Add(new Source($"window:{window.ToInt64()}:0", title.ToString(), processId));
                    return true;
                }, IntPtr.Zero)) throw new InvalidOperationException("Could not list application windows.");
                Console.OutputEncoding = Encoding.UTF8;
                Console.WriteLine(JsonSerializer.Serialize(sources));
                return 0;
            }

            if (args.Length != 3 || args[0] != "--restore-window")
                throw new ArgumentException("Invalid window capture arguments.");
            var parts = args[1].Split(':');
            if (parts.Length != 3 || parts[0] != "window" || parts[2] != "0" ||
                !long.TryParse(parts[1], out var handle) || handle <= 0 ||
                !uint.TryParse(args[2], out var expectedProcessId) || expectedProcessId == 0)
                throw new ArgumentException("Invalid application window.");
            var target = new IntPtr(handle);
            GetWindowThreadProcessId(target, out var actualProcessId);
            if (actualProcessId != expectedProcessId || !IsApplicationWindow(target))
                throw new InvalidOperationException("The selected application window is no longer available.");
            if (IsIconic(target))
            {
                // post restoration so an unresponsive application cannot block this helper.
                if (!ShowWindowAsync(target, 9))
                    throw new InvalidOperationException("Could not restore the selected application window.");
                for (var attempt = 0; attempt < 40 && IsIconic(target); attempt++) Thread.Sleep(50);
                if (IsIconic(target))
                    throw new InvalidOperationException("The selected application window did not restore.");
            }
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    private static bool IsApplicationWindow(IntPtr window)
    {
        if (!IsWindowVisible(window) || GetAncestor(window, 2) != window) return false;
        var style = GetWindowLong(window, -20);
        if ((style & 0x80) != 0 || (GetWindow(window, 4) != IntPtr.Zero && (style & 0x40000) == 0)) return false;
        if (DwmGetWindowAttribute(window, 14, out var cloaked, sizeof(int)) == 0 && cloaked != 0) return false;
        // respect applications that exclude their windows from screen capture.
        return !GetWindowDisplayAffinity(window, out var affinity) || affinity == 0;
    }

    private delegate bool EnumWindowCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] private static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")] private static extern bool GetWindowDisplayAffinity(IntPtr window, out uint affinity);
    [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);
}
