# Setup do Servidor de Streaming (Hetzner)

## 1. Criar o servidor na Hetzner

Acesse https://console.hetzner.cloud e crie:
- **Tipo**: CCX33 (8 vCPU AMD, 32GB RAM, 20TB tráfego)
- **OS**: Ubuntu 24.04
- **Localização**: Nuremberg ou Helsinki (mais rápido para Brasil via Cloudflare)
- **Custo**: €62.90/mês ≈ **R$375/mês**

> Para 30 streamers simultâneos com screen share (baixo movimento),
> o CCX33 é suficiente. Para câmera HD de alta qualidade, use CCX43 (€104.90/mês).

## 2. Configurar o servidor (copiar e colar no terminal SSH)

```bash
# Conectar via SSH
ssh root@IP_DO_SERVIDOR

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Instalar Certbot (SSL grátis)
apt install certbot -y

# Criar pasta do projeto
mkdir /opt/streaming && cd /opt/streaming

# Copiar os arquivos da pasta /server/ do seu repositório
# (pode usar git clone ou scp)

# Ajustar o domínio no nginx.conf
sed -i 's/SEU_DOMINIO_AQUI/stream.seudominio.com.br/g' nginx.conf
```

## 3. Configurar DNS no Cloudflare

1. Acesse o painel do Cloudflare do seu domínio
2. Adicione registro **A**:
   - Nome: `stream`
   - Valor: `IP_DO_SERVIDOR`
   - **Proxy: LIGADO** (nuvem laranja) ← isso ativa o CDN gratuito!

> Com o proxy do Cloudflare ativado, todo o tráfego HLS para viewers
> passa pelo CDN do Cloudflare → você não paga bandwidth de saída.

## 4. Obter certificado SSL

```bash
cd /opt/streaming

# Iniciar nginx temporário para verificação do domínio
docker run -d -p 80:80 -v /var/www/certbot:/var/www/certbot nginx:alpine

# Obter certificado
certbot certonly --webroot -w /var/www/certbot -d stream.seudominio.com.br

# Parar nginx temporário
docker stop $(docker ps -q)
```

## 5. Iniciar o servidor de streaming

```bash
cd /opt/streaming
docker compose up -d

# Verificar se está rodando
docker compose ps
docker compose logs -f mediamtx
```

## 6. Testar

Abra: `https://stream.seudominio.com.br/hls/TESTE/index.m3u8`
Deve retornar 404 (normal, significa que o servidor está respondendo).

## 7. Configurar no app (Vercel)

No painel do Vercel, adicione as variáveis de ambiente:
```
VITE_MEDIA_SERVER_URL = https://stream.seudominio.com.br
VITE_MEDIA_SERVER_KEY = (deixe vazio por enquanto)
```

Pronto! O app automaticamente usará HLS para viewers e WHIP para streamers.

---

## Resumo de Custos

| Item                          | Custo/mês        |
|-------------------------------|-----------------|
| Hetzner CCX33 (servidor)      | €62.90 ≈ R$375  |
| Cloudflare CDN (bandwidth)    | **R$0**         |
| SSL (Let's Encrypt)           | **R$0**         |
| Cloudflare R2 (opcional)      | ~R$5            |
| **TOTAL**                     | **~R$380/mês**  |

Capacidade: **30 streamers × 10.000 viewers simultâneos = 300.000 usuários**

---

## Manutenção

```bash
# Ver uso de CPU/RAM em tempo real
htop

# Ver streams ativas agora
curl http://localhost:9997/v3/paths/list | python3 -m json.tool

# Atualizar MediaMTX
docker compose pull && docker compose up -d

# Ver logs de erros
docker compose logs mediamtx --tail=100
```
