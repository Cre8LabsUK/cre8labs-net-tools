using System;
using System.IO;
using System.Security.Cryptography;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace Cre8Labs.NetTools
{
    /// <summary>
    /// For making explainer videos ("--demo --capture &lt;folder&gt;"): the app renders its own window, with any open
    /// dialog drawn on top, to PNG files ten times a second. Each file is named by its UTC tick time, and unchanged
    /// frames are skipped. It does not depend on the screen size or on what else is on the screen.
    /// </summary>
    public sealed class CaptureRecorder
    {
        public const double Width = 1600, Height = 900;
        /// <summary>Frames are drawn at twice the size, so the video can zoom in and stay sharp.</summary>
        const int Scale = 2;

        readonly Window _main;
        readonly string _folder;
        readonly MD5 _md5 = MD5.Create();
        readonly DispatcherTimer _timer;
        string _lastHash = "";

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);

        /// <summary>Lets the window grow past the screen size, so frames are always the full capture size.</summary>
        public static IntPtr AllowLargeWindow(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            const int WmGetMinMaxInfo = 0x0024;
            if (msg == WmGetMinMaxInfo)
            {
                // MINMAXINFO: five POINTs; ptMaxSize at 8, ptMaxTrackSize at 32.
                System.Runtime.InteropServices.Marshal.WriteInt32(lParam, 8, 8000);
                System.Runtime.InteropServices.Marshal.WriteInt32(lParam, 12, 8000);
                System.Runtime.InteropServices.Marshal.WriteInt32(lParam, 32, 8000);
                System.Runtime.InteropServices.Marshal.WriteInt32(lParam, 36, 8000);
                handled = true;
            }
            return IntPtr.Zero;
        }

        /// <summary>
        /// Fixes the main window's content at the capture size and sizes the window to match, whatever the screen
        /// size (a small remote desktop screen would otherwise squeeze the layout).
        /// </summary>
        public static void FitWindow(Window main)
        {
            if (main.Content is FrameworkElement root)
            {
                root.Width = Width;
                root.Height = Height;
            }
            var dpi = VisualTreeHelper.GetDpi(main);
            var hwnd = new System.Windows.Interop.WindowInteropHelper(main).Handle;
            SetWindowPos(hwnd, IntPtr.Zero, 0, 0, (int)Math.Round(Width * dpi.DpiScaleX), (int)Math.Round(Height * dpi.DpiScaleY), 0x0014);
        }

        public CaptureRecorder(Window main, string folder)
        {
            _main = main;
            _folder = folder;
            Directory.CreateDirectory(folder);
            _timer = new DispatcherTimer(DispatcherPriority.Normal) { Interval = TimeSpan.FromMilliseconds(100) };
            _timer.Tick += (s, e) => Save();
            _timer.Start();
            main.Closed += (s, e) => _timer.Stop();
        }

        static RenderTargetBitmap Render(Window window, int w, int h)
        {
            // The window can be smaller than the capture size on a small screen, which would clip the content,
            // so lay it out at the capture size before drawing it.
            if (window.Content is UIElement element)
            {
                element.Measure(new Size(w, h));
                element.Arrange(new Rect(0, 0, w, h));
            }
            var bitmap = new RenderTargetBitmap(w * Scale, h * Scale, 96 * Scale, 96 * Scale, PixelFormats.Pbgra32);
            var background = new DrawingVisual();
            using (var dc = background.RenderOpen()) dc.DrawRectangle(window.Background, null, new Rect(0, 0, w, h));
            bitmap.Render(background);
            if (window.Content is Visual content) bitmap.Render(content);
            return bitmap;
        }

        void Save()
        {
            const int w = (int)Width, h = (int)Height;

            var visual = new DrawingVisual();
            using (var dc = visual.RenderOpen())
            {
                dc.DrawImage(Render(_main, w, h), new Rect(0, 0, w, h));
                foreach (Window owned in _main.OwnedWindows)
                {
                    if (!owned.IsVisible) continue;
                    // Dim the main window, then draw the dialog where it sits relative to it.
                    dc.DrawRectangle(new SolidColorBrush(Color.FromArgb(80, 14, 39, 68)), null, new Rect(0, 0, w, h));
                    int dw = (int)Math.Round(owned.ActualWidth), dh = (int)Math.Round(owned.ActualHeight);
                    if (dw <= 0 || dh <= 0) continue;
                    var area = new Rect(owned.Left - _main.Left, owned.Top - _main.Top, dw, dh);
                    if (area.Right > w) area.X = Math.Max(0, w - area.Width);
                    if (area.Bottom > h) area.Y = Math.Max(0, h - area.Height);
                    if (area.X < 0) area.X = 0;
                    if (area.Y < 0) area.Y = 0;
                    dc.DrawImage(Render(owned, dw, dh), area);
                }
            }

            var bitmap = new RenderTargetBitmap(w * Scale, h * Scale, 96 * Scale, 96 * Scale, PixelFormats.Pbgra32);
            bitmap.Render(visual);
            var pixels = new byte[w * Scale * h * Scale * 4];
            bitmap.CopyPixels(pixels, w * Scale * 4, 0);
            var hash = Convert.ToBase64String(_md5.ComputeHash(pixels));
            if (hash == _lastHash) return;
            _lastHash = hash;

            var encoder = new PngBitmapEncoder();
            encoder.Frames.Add(BitmapFrame.Create(bitmap));
            try
            {
                using (var file = File.Create(Path.Combine(_folder, $"f{DateTime.UtcNow.Ticks}.png")))
                    encoder.Save(file);
            }
            catch (IOException) { } // a missed frame is harmless
        }
    }
}
