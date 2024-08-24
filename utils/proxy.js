export const getProxy = (proxy) => {
  if (!proxy) return;
  const proxyConfig = proxy.split("://");
  let protocol, host, port, username, password;
  if (proxyConfig.length > 1) {
    protocol = proxyConfig[0];
    [host, port, username, password] = proxyConfig[1].split(":");
  } else {
    protocol = "http";
    [host, port, username, password] = proxyConfig[0].split(":");
  }

  return { protocol, host, port, username, password };
};
