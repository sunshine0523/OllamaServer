package io.kindbrave.ollamaserver.utils

import android.content.Context
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File
import java.io.IOException
import java.net.Socket
import androidx.core.content.edit
import io.kindbrave.ollamaserver.module.OllamaConfigModule

class OllamaExecutor(private val context: Context) {

    companion object {
        private const val BINARY_NAME = "ollama"
        private const val PREFS_NAME = "ollama_prefs"
        private const val PREF_BINARY_VERSION = "binary_version"

        private const val OLLAMA_PORT = 11434
        private const val HOST = "127.0.0.1"

        fun ollamaRunning(): Boolean {
            return try {
                Socket(HOST, OLLAMA_PORT).use { true }
            } catch (e: Exception) {
                false
            }
        }
    }

    // 带状态检查的初始化方法
    fun setupEnvironment(): Boolean {
        return if (isInitializationDone()) {
            true // 已初始化直接返回成功
        } else {
            performInitialization() // 执行实际初始化
        }
    }

    private fun isInitializationDone(): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        return try {
            val savedVersion = prefs.getString(PREF_BINARY_VERSION, "") ?: ""
            val currentVersion = readBinaryVersionFromAssets()

            // 检查版本是否匹配且文件存在
            savedVersion == currentVersion
                    && File(getBinaryDir(), BINARY_NAME).exists()
                    && File(getBinaryDir(), "lib").exists()
        } catch (e: Exception) {
            false
        }
    }

    private fun readBinaryVersionFromAssets(): String {
        val assetPath = when (Build.SUPPORTED_ABIS.firstOrNull()) {
            "arm64-v8a" -> "arm64-v8a/version.txt"
            "armeabi-v7a" -> "armeabi-v7a/version.txt"
            else -> throw IOException("Unsupported ABI")
        }

        return context.assets.open(assetPath).bufferedReader().use { it.readLine() }
    }

    private fun performInitialization(): Boolean {
        return try {
            getBinaryDir().takeIf { !it.exists() }?.mkdirs()
            copyBinaryFile()
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    private fun copyBinaryFile() {
        val currentVersion = readBinaryVersionFromAssets()
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedVersion = prefs.getString(PREF_BINARY_VERSION, "") ?: ""

        // 版本号比较（语义化版本）
        if (compareVersions(currentVersion, savedVersion) > 0) {
            // 实际复制文件逻辑
            val targetFile = File(getBinaryDir(), BINARY_NAME)
            if (targetFile.exists()) {
                // 存在则先删除旧版本
                targetFile.delete()
            }

            // 根据设备架构选择正确的二进制文件路径
            val assetPath = when (Build.SUPPORTED_ABIS.firstOrNull()) {
                "arm64-v8a" -> "arm64-v8a/$BINARY_NAME"
                "armeabi-v7a" -> "armeabi-v7a/$BINARY_NAME"
                else -> throw IOException("Unsupported ABI")
            }

            context.assets.open(assetPath).use { input ->
                targetFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }

            // 复制依赖库目录（lib/ 与 lib/ollama/）
            val abi = when (Build.SUPPORTED_ABIS.firstOrNull()) {
                "arm64-v8a" -> "arm64-v8a"
                "armeabi-v7a" -> "armeabi-v7a"
                else -> throw IOException("Unsupported ABI")
            }
            copyAssetDirRecursive("$abi/lib", File(getBinaryDir(), "lib"))

            // assets 复制不保留可执行位，需手动设置（否则 llama-server spawn 报 permission denied）
            File(getBinaryDir(), "lib/ollama/llama-server").setExecutable(true)
            File(getBinaryDir(), "lib/ollama/llama-quantize").setExecutable(true)

            // 设置可执行权限（重试机制）
            if (!targetFile.setExecutable(true)) {
                throw IOException("Failed to set executable permission")
            }
            // 更新版本号
            prefs.edit { putString(PREF_BINARY_VERSION, currentVersion) }
        }
    }

    /** 递归复制 assets 中的目录（用于 ollama 依赖库 lib/ 与 lib/ollama/） */
    private fun copyAssetDirRecursive(assetDir: String, targetDir: File) {
        targetDir.mkdirs()
        context.assets.list(assetDir)?.forEach { name ->
            val childPath = "$assetDir/$name"
            val childTarget = File(targetDir, name)
            if (childTarget.exists()) {
                childTarget.delete()
            }
            try {
                context.assets.open(childPath).use { input ->
                    childTarget.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
            } catch (e: IOException) {
                // 是子目录，递归复制
                copyAssetDirRecursive(childPath, childTarget)
            }
        }
    }

    private fun compareVersions(current: String, saved: String): Int {
        if (saved.isEmpty()) return 1 // 首次安装

        val currentParts = current.split('.').map { it.toInt() }
        val savedParts = saved.split('.').map { it.toInt() }

        for (i in 0 until maxOf(currentParts.size, savedParts.size)) {
            val curr = currentParts.getOrElse(i) { 0 }
            val save = savedParts.getOrElse(i) { 0 }
            when {
                curr > save -> return 1
                curr < save -> return -1
            }
        }
        return 0
    }

    // 获取二进制文件目录（隔离不同架构）
    private fun getBinaryDir(): File {
        val abi = when (Build.SUPPORTED_ABIS.firstOrNull()) {
            "arm64-v8a" -> "arm64-v8a"
            "armeabi-v7a" -> "armeabi-v7a"
            else -> throw IOException("Unsupported ABI")
        }
        return File(context.filesDir, "bin/$abi").apply {
            mkdirs()
        }
    }

    private fun getHomeDir() = context.filesDir

    fun startOllamaService(): Process? {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val lanListening = prefs.getBoolean(OllamaConfigModule.LAN_LISTENING, false)

            LogUtils.getInstance(context).clearLogFile()

            val nativeLibDir = context.applicationInfo.nativeLibraryDir
            val binaryDir = getBinaryDir()
            val binaryPath = File("${binaryDir}/$BINARY_NAME").absolutePath
            val libDir = File(binaryDir, "lib").absolutePath
            val libOllamaDir = File(File(binaryDir, "lib"), "ollama").absolutePath
            val homeDir = getHomeDir().absolutePath

            val processBuilder = ProcessBuilder(binaryPath, "serve")
                .directory(context.filesDir)
                .redirectErrorStream(true) // 合并 stderr 到 stdout

            val env = processBuilder.environment()
            env["LD_LIBRARY_PATH"] = "$libDir:$libOllamaDir:$nativeLibDir:${env["LD_LIBRARY_PATH"] ?: ""}"
            env["OLLAMA_LIBRARY_PATH"] = libOllamaDir // 新版 ollama 依赖库与 llama-server 所在目录
            // Android app 没有 /tmp，必须显式指定临时目录（新版 llama.cpp 引擎重度依赖）
            val tmpDir = File(context.filesDir, "tmp").apply { mkdirs() }
            env["OLLAMA_TMPDIR"] = tmpDir.absolutePath
            env["HOME"] = homeDir
            env["OLLAMA_DEBUG"] = "1"
            if (lanListening) env["OLLAMA_HOST"] = "0.0.0.0"
            else env["OLLAMA_HOST"] = "127.0.0.1"

            processBuilder.start().also { process ->
                Thread { consumeProcessOutput(process) }.start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun consumeProcessOutput(process: Process) {
        CoroutineScope(Dispatchers.IO).launch {
            process.inputStream.bufferedReader().use { reader ->
                while (process.isAlive) {
                    try {
                        reader.readLine()?.let { line ->
                            LogUtils.getInstance(context).log(line)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }
    }

    fun stopOllamaService(process: Process?) {
        process?.destroy()
    }
}