#!/usr/bin/env bash
# =============================================================================
#  Socket BaaS — Production 1-Click Installer
#  https://github.com/saaduddinsony/socket
#  License: Apache 2.0
# =============================================================================

set -euo pipefail

# Text styling
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

log_info() {
    printf "${BLUE}${BOLD}[SOCKET]${RESET} %s\n" "$1"
}

log_success() {
    printf "${GREEN}${BOLD}[SUCCESS]${RESET} %s\n" "$1"
}

log_warning() {
    printf "${YELLOW}${BOLD}[WARNING]${RESET} %s\n" "$1"
}

log_error() {
    printf "${RED}${BOLD}[ERROR]${RESET} %s\n" "$1" >&2
}

# ASCII Banner
print_banner() {
    cat << "EOF"
  ____             _        _   
 / ___|  ___   ___| | _____| |_ 
 \___ \ / _ \ / __| |/ / _ \ __|
  ___) | (_) | (__|   <  __/ |_ 
 |____/ \___/ \___|_|\_\___|\__|

  Next-Gen Open-Source BaaS with Native Multi-Tenancy & AI
  https://github.com/saaduddinsony/socket
EOF
    echo ""
}

# Base64url encode helper
b64url() {
    openssl enc -base64 -A | tr '+/' '-_' | tr -d '='
}

# Sign HS256 JWT using openssl
sign_jwt() {
    local payload="$1"
    local secret="$2"
    local header='{"alg":"HS256","typ":"JWT"}'
    
    local encoded_header
    local encoded_payload
    encoded_header=$(printf '%s' "$header" | b64url)
    encoded_payload=$(printf '%s' "$payload" | b64url)
    
    local signature
    signature=$(printf '%s.%s' "$encoded_header" "$encoded_payload" | openssl dgst -sha256 -hmac "$secret" -binary | b64url)
    
    printf '%s.%s.%s' "$encoded_header" "$encoded_payload" "$signature"
}

main() {
    print_banner

    # 1. Environment and Working Directory Check
    if [ ! -f "docker-compose.yml" ]; then
        log_info "No docker-compose.yml found in current directory."
        if [ -d "socket" ]; then
            log_info "Entering existing ./socket directory..."
            cd socket
        else
            log_info "Cloning Socket repository from GitHub..."
            git clone https://github.com/saaduddinsony/socket.git socket
            cd socket
        fi
    fi

    # 2. Check Docker
    log_info "Checking Docker environment..."
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found."
        if [ -f /etc/debian_version ]; then
            log_info "Attempting to install Docker on Debian/Ubuntu..."
            curl -fsSL https://get.docker.com | sh
            sudo usermod -aG docker "$USER" || true
            log_success "Docker installed successfully."
        else
            log_error "Docker is required. Please install Docker and retry: https://docs.docker.com/engine/install/"
            exit 1
        fi
    fi

    # Verify Compose
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        log_error "Docker Compose plugin is not installed. Please install docker-compose-plugin."
        exit 1
    fi

    # 3. Setup .env file
    if [ ! -f ".env" ]; then
        log_info "Creating .env from .env.example..."
        cp .env.example .env
    else
        log_info "Existing .env detected. Preserving existing configurations."
    fi

    # 4. Generate Cryptographic Keys if missing
    log_info "Ensuring cryptographic secrets are provisioned..."
    if command -v python3 &> /dev/null && python3 -c "import jwt, cryptography" 2>/dev/null; then
        python3 gen-keys.py
    else
        # Pure Bash + OpenSSL fallback key generator
        log_info "Provisioning cryptographic keys using OpenSSL..."

        # Read or generate secrets
        POSTGRES_PASSWORD=$(openssl rand -hex 16)
        JWT_SECRET=$(openssl rand -hex 32)
        SECRET_KEY_BASE=$(openssl rand -hex 32)
        PG_META_CRYPTO_KEY=$(openssl rand -hex 16)
        API_KEY_ENCRYPTION_KEY=$(openssl rand -base64 32)
        DASHBOARD_USERNAME="admin"
        DASHBOARD_PASSWORD=$(openssl rand -hex 12)

        NOW=$(date +%s)
        EXP=$((NOW + 157680000)) # 5 years

        ANON_PAYLOAD="{\"role\":\"anon\",\"iss\":\"socket\",\"iat\":$NOW,\"exp\":$EXP}"
        SERVICE_PAYLOAD="{\"role\":\"service_role\",\"iss\":\"socket\",\"iat\":$NOW,\"exp\":$EXP}"

        ANON_KEY=$(sign_jwt "$ANON_PAYLOAD" "$JWT_SECRET")
        SERVICE_ROLE_KEY=$(sign_jwt "$SERVICE_PAYLOAD" "$JWT_SECRET")

        # Replace in .env
        set_env() {
            local key="$1"
            local val="$2"
            if grep -q "^${key}=" .env; then
                sed -i.bak "s|^${key}=.*|${key}=${val}|" .env && rm -f .env.bak
            else
                printf "%s=%s\n" "$key" "$val" >> .env
            fi
        }

        # Only set if empty or unset
        if grep -E "^POSTGRES_PASSWORD=($|\s)" .env >/dev/null 2>&1; then set_env "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"; fi
        if grep -E "^JWT_SECRET=($|\s)" .env >/dev/null 2>&1; then set_env "JWT_SECRET" "$JWT_SECRET"; fi
        if grep -E "^ANON_KEY=($|\s)" .env >/dev/null 2>&1; then set_env "ANON_KEY" "$ANON_KEY"; fi
        if grep -E "^SERVICE_ROLE_KEY=($|\s)" .env >/dev/null 2>&1; then set_env "SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY"; fi
        if grep -E "^DASHBOARD_USERNAME=($|\s)" .env >/dev/null 2>&1; then set_env "DASHBOARD_USERNAME" "$DASHBOARD_USERNAME"; fi
        if grep -E "^DASHBOARD_PASSWORD=($|\s)" .env >/dev/null 2>&1; then set_env "DASHBOARD_PASSWORD" "$DASHBOARD_PASSWORD"; fi
        if grep -E "^SECRET_KEY_BASE=($|\s)" .env >/dev/null 2>&1; then set_env "SECRET_KEY_BASE" "$SECRET_KEY_BASE"; fi
        if grep -E "^PG_META_CRYPTO_KEY=($|\s)" .env >/dev/null 2>&1; then set_env "PG_META_CRYPTO_KEY" "$PG_META_CRYPTO_KEY"; fi
        if grep -E "^API_KEY_ENCRYPTION_KEY=($|\s)" .env >/dev/null 2>&1; then set_env "API_KEY_ENCRYPTION_KEY" "$API_KEY_ENCRYPTION_KEY"; fi
    fi

    # 5. Pull & Start Containers
    log_info "Pulling container images (including Socket Studio Bencho UI)..."
    $DOCKER_COMPOSE pull

    log_info "Launching Socket BaaS services..."
    $DOCKER_COMPOSE up -d

    # Determine Host IP
    HOST_IP="localhost"
    if command -v curl &> /dev/null; then
        HOST_IP=$(curl -s --connect-timeout 2 https://ifconfig.me || echo "localhost")
    fi

    DB_USER=$(grep -E "^DASHBOARD_USERNAME=" .env | cut -d '=' -f2- || echo "admin")
    DB_PASS=$(grep -E "^DASHBOARD_PASSWORD=" .env | cut -d '=' -f2- || echo "check .env")

    echo ""
    log_success "Socket BaaS is UP and RUNNING!"
    echo "============================================================================="
    printf "${BOLD}👉 Studio Dashboard:${RESET}    http://%s:8000\n" "$HOST_IP"
    printf "${BOLD}🔑 Username:${RESET}            %s\n" "$DB_USER"
    printf "${BOLD}🔒 Password:${RESET}            %s\n" "$DB_PASS"
    echo "============================================================================="
    printf "${YELLOW}Next Step:${RESET} Add your OpenAI API key in ${BOLD}.env${RESET} for vector embeddings & AI agents:\n"
    printf "          OPENAI_API_KEY=sk-...\n\n"
}

main "$@"
