using System;
using System.IO;
using System.Windows;
using System.Windows.Threading;

namespace Cre8Labs.NetTools
{
    public partial class App : Application
    {
        /// <summary>Set by "--demo --capture &lt;folder&gt;" when recording frames for explainer videos.</summary>
        public static string CaptureFolder { get; private set; }

        public static string CrashLogPath => Path.Combine(Path.GetTempPath(), "Cre8Labs-NetTools-crash.log");

        protected override void OnStartup(StartupEventArgs e)
        {
            DispatcherUnhandledException += OnDispatcherUnhandledException;
            AppDomain.CurrentDomain.UnhandledException += (s, args) => WriteCrash(args.ExceptionObject as Exception);
            Core.NetworkService.DemoMode = Array.IndexOf(e.Args, "--demo") >= 0;
            // Explainer video capture, only together with demo mode so it can never record a real network.
            var capture = Array.IndexOf(e.Args, "--capture");
            if (Core.NetworkService.DemoMode && capture >= 0 && capture + 1 < e.Args.Length) CaptureFolder = e.Args[capture + 1];
            base.OnStartup(e);
        }

        void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
        {
            WriteCrash(e.Exception);
            MessageBox.Show("Something went wrong:\n\n" + e.Exception.Message + "\n\nDetails were saved to:\n" + CrashLogPath,
                "Cre8Labs Net Tools", MessageBoxButton.OK, MessageBoxImage.Error);
            e.Handled = true;
        }

        static void WriteCrash(Exception ex)
        {
            try { File.AppendAllText(CrashLogPath, $"[{DateTime.Now:u}]\n{ex}\n\n"); }
            catch (IOException) { }
        }
    }
}
