using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SandShark.ProcessAudioCapture;

internal static class Program
{
    private const string HeaderPrefix = "SANDSHARK_PROCESS_AUDIO ";

    public static int Main(string[] args)
    {
        if (args.Length != 1)
        {
            Console.Error.WriteLine("Usage: ProcessAudioCapture <window-source-id>");
            return 2;
        }

        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 20348))
        {
            Console.Error.WriteLine("Windows 10 build 20348 or later is required.");
            return 3;
        }

        try
        {
            var processId = ResolveWindowProcessId(args[0]);
            using var capture = new ProcessLoopbackCapture(processId);
            capture.Start();
            WriteHeader(capture.Format);
            capture.CopyTo(Console.OpenStandardOutput());
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    private static void WriteHeader(WaveFormat format)
    {
        var header = JsonSerializer.Serialize(new
        {
            sampleRate = format.SampleRate,
            channels = format.Channels,
            bitsPerSample = format.BitsPerSample,
            format = format.IsFloat ? "f32" : "s16"
        });
        var bytes = Encoding.UTF8.GetBytes($"{HeaderPrefix}{header}\n");
        Console.OpenStandardOutput().Write(bytes, 0, bytes.Length);
    }

    private static uint ResolveWindowProcessId(string sourceId)
    {
        var match = Regex.Match(sourceId, "^window:(?<handle>\\d+):");
        if (!match.Success || !long.TryParse(match.Groups["handle"].Value, out var rawHandle))
        {
            throw new InvalidOperationException("The selected capture source is not an application window.");
        }

        var windowHandle = new IntPtr(rawHandle);
        if (!NativeMethods.IsWindow(windowHandle))
        {
            throw new InvalidOperationException("The selected application window is no longer available.");
        }

        NativeMethods.GetWindowThreadProcessId(windowHandle, out var processId);
        if (processId == 0) throw new InvalidOperationException("Could not resolve the selected application's process.");
        return processId;
    }
}

internal sealed class ProcessLoopbackCapture : IDisposable
{
    private const uint AudclntStreamFlagsLoopback = 0x00020000;
    private const uint AudclntStreamFlagsEventCallback = 0x00040000;
    private const uint AudclntBufferFlagsSilent = 0x00000002;
    private const string VirtualProcessLoopbackDevice = "VAD\\Process_Loopback";

    private readonly uint _processId;
    private readonly ManualResetEvent _sampleReady = new(false);
    private readonly ManualResetEvent _stopRequested = new(false);
    private IAudioClient? _audioClient;
    private IAudioCaptureClient? _captureClient;
    private IntPtr _mixFormat;

    public ProcessLoopbackCapture(uint processId) => _processId = processId;

    public WaveFormat Format { get; private set; }

    public void Start()
    {
        NativeMethods.CoInitializeEx(IntPtr.Zero, NativeMethods.CoinitMultithreaded);

        var activation = new AudioClientActivationParams
        {
            ActivationType = AudioClientActivationType.ProcessLoopback,
            ProcessLoopbackParams = new AudioClientProcessLoopbackParams
            {
                ProcessLoopbackMode = ProcessLoopbackMode.IncludeTargetProcessTree,
                TargetProcessId = _processId
            }
        };
        var activationSize = Marshal.SizeOf<AudioClientActivationParams>();
        var activationMemory = Marshal.AllocCoTaskMem(activationSize);

        try
        {
            Marshal.StructureToPtr(activation, activationMemory, false);
            var blob = new PropVariantBlob
            {
                VariantType = NativeMethods.VtBlob,
                BlobSize = activationSize,
                BlobData = activationMemory
            };
            var clientId = typeof(IAudioClient).GUID;
            using var completion = new ActivationCompletionHandler();
            var result = NativeMethods.ActivateAudioInterfaceAsync(
                VirtualProcessLoopbackDevice,
                ref clientId,
                ref blob,
                completion,
                out var operation);
            Marshal.ThrowExceptionForHR(result);

            try
            {
                completion.Wait();
                _audioClient = completion.GetAudioClient();
            }
            finally
            {
                if (operation != IntPtr.Zero) Marshal.Release(operation);
            }
        }
        finally
        {
            Marshal.FreeCoTaskMem(activationMemory);
        }

        if (_audioClient is null) throw new InvalidOperationException("Windows did not activate process audio capture.");

        Marshal.ThrowExceptionForHR(_audioClient.GetMixFormat(out _mixFormat));
        Format = WaveFormat.FromNative(_mixFormat);
        if (Format.Channels is < 1 or > 2 || (Format.BitsPerSample != 16 && !Format.IsFloat))
        {
            throw new InvalidOperationException("The selected application uses an unsupported audio format.");
        }

        Marshal.ThrowExceptionForHR(_audioClient.Initialize(
            AudioClientShareMode.Shared,
            AudclntStreamFlagsLoopback | AudclntStreamFlagsEventCallback,
            0,
            0,
            _mixFormat,
            IntPtr.Zero));
        Marshal.ThrowExceptionForHR(_audioClient.SetEventHandle(_sampleReady.SafeWaitHandle.DangerousGetHandle()));
        var captureClientId = typeof(IAudioCaptureClient).GUID;
        Marshal.ThrowExceptionForHR(_audioClient.GetService(ref captureClientId, out var captureClient));
        _captureClient = (IAudioCaptureClient)Marshal.GetObjectForIUnknown(captureClient);
        Marshal.Release(captureClient);
        Marshal.ThrowExceptionForHR(_audioClient.Start());
    }

    public void CopyTo(Stream output)
    {
        if (_captureClient is null) throw new InvalidOperationException("Process audio capture has not started.");

        var waitHandles = new WaitHandle[] { _sampleReady, _stopRequested };
        while (WaitHandle.WaitAny(waitHandles) == 0)
        {
            while (true)
            {
                Marshal.ThrowExceptionForHR(_captureClient.GetNextPacketSize(out var frames));
                if (frames == 0) break;

                Marshal.ThrowExceptionForHR(_captureClient.GetBuffer(
                    out var data,
                    out frames,
                    out var flags,
                    out _,
                    out _));
                try
                {
                    var byteCount = checked((int)(frames * Format.BlockAlign));
                    if ((flags & AudclntBufferFlagsSilent) != 0)
                    {
                        output.Write(new byte[byteCount], 0, byteCount);
                    }
                    else
                    {
                        var bytes = new byte[byteCount];
                        Marshal.Copy(data, bytes, 0, byteCount);
                        output.Write(bytes, 0, byteCount);
                    }
                    output.Flush();
                }
                finally
                {
                    Marshal.ThrowExceptionForHR(_captureClient.ReleaseBuffer(frames));
                }
            }
        }
    }

    public void Dispose()
    {
        _stopRequested.Set();
        if (_audioClient is not null) _audioClient.Stop();
        if (_mixFormat != IntPtr.Zero) Marshal.FreeCoTaskMem(_mixFormat);
        if (_captureClient is not null) Marshal.ReleaseComObject(_captureClient);
        if (_audioClient is not null) Marshal.ReleaseComObject(_audioClient);
        _sampleReady.Dispose();
        _stopRequested.Dispose();
        NativeMethods.CoUninitialize();
    }
}

internal readonly record struct WaveFormat(uint SampleRate, ushort Channels, ushort BitsPerSample, ushort BlockAlign, bool IsFloat)
{
    public static WaveFormat FromNative(IntPtr format)
    {
        var native = Marshal.PtrToStructure<WaveFormatEx>(format);
        var isFloat = native.FormatTag == NativeMethods.WaveFormatIeeeFloat ||
            (native.FormatTag == NativeMethods.WaveFormatExtensible &&
             Marshal.PtrToStructure<WaveFormatExtensible>(format).SubFormat == NativeMethods.KsDataFormatSubTypeIeeeFloat);
        return new WaveFormat(native.SamplesPerSec, native.Channels, native.BitsPerSample, native.BlockAlign, isFloat);
    }
}

[StructLayout(LayoutKind.Sequential, Pack = 2)]
internal struct WaveFormatEx
{
    public ushort FormatTag;
    public ushort Channels;
    public uint SamplesPerSec;
    public uint AverageBytesPerSec;
    public ushort BlockAlign;
    public ushort BitsPerSample;
    public ushort ExtraSize;
}

[StructLayout(LayoutKind.Sequential, Pack = 2)]
internal struct WaveFormatExtensible
{
    public WaveFormatEx Format;
    public ushort ValidBitsPerSample;
    public uint ChannelMask;
    public Guid SubFormat;
}

[StructLayout(LayoutKind.Sequential)]
internal struct PropVariantBlob
{
    public ushort VariantType;
    public ushort Reserved1;
    public ushort Reserved2;
    public ushort Reserved3;
    public int BlobSize;
    public IntPtr BlobData;
}

[StructLayout(LayoutKind.Sequential)]
internal struct AudioClientActivationParams
{
    public AudioClientActivationType ActivationType;
    public AudioClientProcessLoopbackParams ProcessLoopbackParams;
}

[StructLayout(LayoutKind.Sequential)]
internal struct AudioClientProcessLoopbackParams
{
    public ProcessLoopbackMode ProcessLoopbackMode;
    public uint TargetProcessId;
}

internal enum AudioClientActivationType { Default, ProcessLoopback }
internal enum ProcessLoopbackMode { IncludeTargetProcessTree, ExcludeTargetProcessTree }
internal enum AudioClientShareMode { Shared, Exclusive }

[ComImport, Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioClient
{
    [PreserveSig] int Initialize(AudioClientShareMode shareMode, uint streamFlags, long bufferDuration, long periodicity, IntPtr format, IntPtr audioSessionGuid);
    [PreserveSig] int GetBufferSize(out uint bufferSize);
    [PreserveSig] int GetStreamLatency(out long latency);
    [PreserveSig] int GetCurrentPadding(out uint padding);
    [PreserveSig] int IsFormatSupported(AudioClientShareMode shareMode, IntPtr format, out IntPtr closestMatch);
    [PreserveSig] int GetMixFormat(out IntPtr deviceFormat);
    [PreserveSig] int GetDevicePeriod(out long defaultPeriod, out long minimumPeriod);
    [PreserveSig] int Start();
    [PreserveSig] int Stop();
    [PreserveSig] int Reset();
    [PreserveSig] int SetEventHandle(IntPtr eventHandle);
    [PreserveSig] int GetService(ref Guid serviceId, out IntPtr service);
}

[ComImport, Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioCaptureClient
{
    [PreserveSig] int GetBuffer(out IntPtr data, out uint framesToRead, out uint flags, out ulong devicePosition, out ulong qpcPosition);
    [PreserveSig] int ReleaseBuffer(uint framesRead);
    [PreserveSig] int GetNextPacketSize(out uint framesInNextPacket);
}

[ComImport, Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IActivateAudioInterfaceAsyncOperation
{
    [PreserveSig] int GetActivateResult(out int activateResult, [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface);
}

[ComImport, Guid("41D949AB-9862-444A-80F6-C261334DA5EB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IActivateAudioInterfaceCompletionHandler
{
    [PreserveSig] int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation);
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.None)]
internal sealed class ActivationCompletionHandler : IActivateAudioInterfaceCompletionHandler, IDisposable
{
    private readonly ManualResetEvent _completed = new(false);
    private int _activationResult = unchecked((int)0x80004005);
    private object? _activatedInterface;

    public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation)
    {
        try
        {
            var result = operation.GetActivateResult(out _activationResult, out _activatedInterface!);
            if (result < 0) _activationResult = result;
        }
        finally
        {
            _completed.Set();
        }
        return 0;
    }

    public void Wait()
    {
        if (!_completed.WaitOne(TimeSpan.FromSeconds(10))) throw new TimeoutException("Timed out while activating process audio capture.");
        Marshal.ThrowExceptionForHR(_activationResult);
    }

    public IAudioClient GetAudioClient() => _activatedInterface as IAudioClient ?? throw new InvalidOperationException("Windows returned an invalid process audio client.");
    public void Dispose() => _completed.Dispose();
}

internal static class NativeMethods
{
    internal const uint CoinitMultithreaded = 0;
    internal const ushort VtBlob = 65;
    internal const ushort WaveFormatIeeeFloat = 3;
    internal const ushort WaveFormatExtensible = 0xFFFE;
    internal static readonly Guid KsDataFormatSubTypeIeeeFloat = new("00000003-0000-0010-8000-00AA00389B71");

    [DllImport("ole32.dll")]
    internal static extern int CoInitializeEx(IntPtr reserved, uint coInit);
    [DllImport("ole32.dll")]
    internal static extern void CoUninitialize();
    [DllImport("Mmdevapi.dll", CharSet = CharSet.Unicode)]
    internal static extern int ActivateAudioInterfaceAsync(string deviceInterfacePath, ref Guid interfaceId, ref PropVariantBlob activationParams, IActivateAudioInterfaceCompletionHandler completionHandler, out IntPtr operation);
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool IsWindow(IntPtr windowHandle);
    [DllImport("user32.dll")]
    internal static extern uint GetWindowThreadProcessId(IntPtr windowHandle, out uint processId);
}
