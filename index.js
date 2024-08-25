import clipboardy from "clipboardy";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile, rename, readdir, access } from 'fs/promises';
import { exec } from 'child_process';

// 获取当前文件的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const downloadedVideosFile = join(__dirname, "downloaded_videos.json");

// 删除特殊字符和控制文件名长度的函数
function sanitizeFileName(name) {
  // 去除特殊字符和控制字符，限制文件名长度
  return name.replace(/[<>:"/\\|?*\n\r\t]/g, '').substring(0, 100);
}

async function loadDownloadedVideos() {
  try {
    const data = await readFile(downloadedVideosFile, "utf8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    } else {
      throw err;
    }
  }
}

async function saveDownloadedVideos(downloadedVideos) {
  try {
    await writeFile(downloadedVideosFile, JSON.stringify(downloadedVideos, null, 2), "utf8");
  } catch (err) {
    console.error("保存已下载视频列表时出错:", err);
  }
}

async function downloadAndRename(video_url, time, title, desc, downloadedVideos, retryCount = 3) {
  return new Promise(async (resolve, reject) => {
    const originalFileName = video_url.split('/').pop();
    const sanitizedTitle = sanitizeFileName(title);
    const sanitizedDesc = sanitizeFileName(desc);
    const outputFileName = `${time}_${sanitizedTitle}_${sanitizedDesc}.mp4`;

    if (downloadedVideos.includes(video_url)) {
      console.log(`视频已存在，跳过下载: ${video_url}`);
      resolve();
      return;
    }

    const process = exec(`lux.exe "${video_url}"`, async (error, stdout, stderr) => {
      if (error) {
        console.error(`下载视频时出错: ${error.message}`);
        if (retryCount > 0) {
          console.log(`重试下载 (${3 - retryCount + 1}/3)...`);
          await downloadAndRename(video_url, time, sanitizedTitle, sanitizedDesc, downloadedVideos, retryCount - 1);
        } else {
          reject(error);
        }
        return;
      }

      if (stderr) {
        const stderrLines = stderr.split('\n').filter(line => !line.includes('['));
        if (stderrLines.length > 0) {
          console.error(`lux.exe 错误输出: ${stderrLines.join('\n')}`);
        }
      }

      setTimeout(async () => {
        try {
          const files = await readdir(__dirname);
          const downloadedFile = files.find(file => file.startsWith(originalFileName));

          if (downloadedFile) {
            const downloadedFilePath = join(__dirname, downloadedFile);

            try {
              await access(downloadedFilePath);
              const destPath = join(__dirname, outputFileName);

              await rename(downloadedFilePath, destPath);
              console.log(`视频已下载并重命名为: ${outputFileName}`);

              downloadedVideos.push(video_url);
              await saveDownloadedVideos(downloadedVideos);

              resolve();
            } catch (accessError) {
              console.error(`无法访问下载的文件: ${accessError.message}`);
              reject(accessError);
            }
          } else {
            console.error("未找到下载的文件");
            reject(new Error("下载的文件未找到"));
          }
        } catch (renameError) {
          console.error(`重命名文件时出错: ${renameError}`);
          reject(renameError);
        }
      }, 2000);
    });

    process.stdout.on('data', (data) => {
      console.log(`lux.exe 输出: ${data}`);
    });

    process.stderr.on('data', (data) => {
      console.error(`lux.exe: ${data}`);
    });

    process.on('error', (err) => {
      console.error(`处理时发生错误: ${err.message}`);
      if (retryCount > 0) {
        console.log(`重试下载 (${3 - retryCount + 1}/3)...`);
        downloadAndRename(video_url, time, sanitizedTitle, sanitizedDesc, downloadedVideos, retryCount - 1).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

async function processNotesFile(filePath) {
  try {
    const data = await readFile(filePath, "utf8");
    const notes = JSON.parse(data);

    const downloadedVideos = await loadDownloadedVideos();

    const filteredNotes = notes.filter(f => f.type === 'video');

    for (let index = 0; index < filteredNotes.length; index++) {
      const { time, title, desc, video_url } = filteredNotes[index];
      await downloadAndRename(video_url, time, title, desc, downloadedVideos);
    }

    console.log("所有视频已下载并重命名");

  } catch (error) {
    console.error("处理文件时出错:", error);
  }
}

const filePath = join(__dirname, "posts.json");
processNotesFile(filePath);
