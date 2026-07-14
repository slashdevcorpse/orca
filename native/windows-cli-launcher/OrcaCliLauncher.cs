using System;
using System.Collections.Specialized;
using System.Diagnostics;
using System.IO;
using System.Text;

internal static class OrcaCliLauncher
{
#if LEAFFISH
    private const string AppExecutableName = "Leaffish.exe";
    private const string ProductName = "Leaffish";
    private const string DistributionName = "leaffish";
#else
    private const string AppExecutableName = "Orca.exe";
    private const string ProductName = "Orca";
    private const string DistributionName = "orca";
#endif

    private static int Main(string[] args)
    {
        try
        {
            string launcherDirectory = Path.GetDirectoryName(typeof(OrcaCliLauncher).Assembly.Location);
            string resourcesDirectory = Directory.GetParent(launcherDirectory).FullName;
            string appDirectory = Directory.GetParent(resourcesDirectory).FullName;
            string electronPath = Path.Combine(appDirectory, AppExecutableName);
            string cliPath = Path.Combine(
                resourcesDirectory,
                "app.asar.unpacked",
                "out",
                "cli",
                "index.js"
            );

            if (!File.Exists(electronPath))
            {
                Console.Error.WriteLine(
                    "Unable to locate {0} next to \"{1}\"",
                    AppExecutableName,
                    resourcesDirectory
                );
                return 1;
            }

            if (!File.Exists(cliPath))
            {
                Console.Error.WriteLine(
                    "Unable to locate the {0} CLI entrypoint at \"{1}\"",
                    ProductName,
                    cliPath
                );
                return 1;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = electronPath,
                Arguments = BuildArguments(cliPath, args),
                UseShellExecute = false
            };

            // Why: launching without cmd.exe preserves embedded newlines while matching the
            // packaged batch launcher's Electron-as-Node environment contract.
            MoveEnvironmentVariable(startInfo.EnvironmentVariables, "NODE_OPTIONS", "ORCA_NODE_OPTIONS");
            MoveEnvironmentVariable(
                startInfo.EnvironmentVariables,
                "NODE_REPL_EXTERNAL_MODULE",
                "ORCA_NODE_REPL_EXTERNAL_MODULE"
            );
            startInfo.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
            startInfo.EnvironmentVariables["ORCA_DISTRIBUTION"] = DistributionName;
#if LEAFFISH
            // Why: the CLI runs Electron as plain Node, so it cannot ask
            // Electron for Leaffish's product-specific userData directory.
            startInfo.EnvironmentVariables["ORCA_USER_DATA_PATH"] = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "leaffish"
            );
#endif

            using (Process child = Process.Start(startInfo))
            {
                child.WaitForExit();
                return child.ExitCode;
            }
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("Unable to start the {0} CLI: {1}", ProductName, error.Message);
            return 1;
        }
    }

    private static void MoveEnvironmentVariable(
        StringDictionary environment,
        string sourceName,
        string targetName
    )
    {
        string value = Environment.GetEnvironmentVariable(sourceName);
        environment.Remove(sourceName);
        environment.Remove(targetName);
        if (value != null)
        {
            environment[targetName] = value;
        }
    }

    private static string BuildArguments(string cliPath, string[] args)
    {
        StringBuilder commandLine = new StringBuilder(QuoteArgument(cliPath));
        foreach (string arg in args)
        {
            commandLine.Append(' ');
            commandLine.Append(QuoteArgument(arg));
        }
        return commandLine.ToString();
    }

    private static string QuoteArgument(string value)
    {
        bool requiresQuotes = value.Length == 0;
        for (int index = 0; index < value.Length && !requiresQuotes; index += 1)
        {
            requiresQuotes = value[index] == '"' || Char.IsWhiteSpace(value[index]);
        }
        if (!requiresQuotes)
        {
            return value;
        }

        StringBuilder quoted = new StringBuilder("\"");
        int backslashCount = 0;
        foreach (char character in value)
        {
            if (character == '\\')
            {
                backslashCount += 1;
                continue;
            }

            if (character == '"')
            {
                quoted.Append('\\', backslashCount * 2 + 1);
                quoted.Append('"');
            }
            else
            {
                quoted.Append('\\', backslashCount);
                quoted.Append(character);
            }
            backslashCount = 0;
        }

        quoted.Append('\\', backslashCount * 2);
        quoted.Append('"');
        return quoted.ToString();
    }
}
