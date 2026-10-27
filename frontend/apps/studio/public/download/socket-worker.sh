#!/usr/bin/env bash
# ==============================================================================
# Socket Multi-Node Compute Worker Agent (Zero-Root Required)
# ==============================================================================
# Turns any VPS, shared hosting terminal, cPanel account, or Raspberry Pi into
# an active compute node in your Socket cluster with live task execution.
#
# Requirements: bash, curl, grep, awk (standard on every Unix/Linux system).
# No root privileges, no open inbound ports, no sudo required!
# ==============================================================================

set -e

HUB_URL=""
WORKER_TOKEN=""
WORKER_NAME=""
POLL_INTERVAL=5

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --hub) HUB_URL="$2"; shift ;;
        --token) WORKER_TOKEN="$2"; shift ;;
        --name) WORKER_NAME="$2"; shift ;;
        --interval) POLL_INTERVAL="$2"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$HUB_URL" ] || [ -z "$WORKER_TOKEN" ]; then
    echo "=========================================================="
    echo " Socket Compute Worker - Configuration Required"
    echo "=========================================================="
    echo "Usage: ./socket-worker.sh --hub <HUB_URL> --token <WORKER_TOKEN> [--name <NAME>]"
    echo ""
    exit 1
fi

HUB_URL="${HUB_URL%/}"
if [ -z "$WORKER_NAME" ]; then
    WORKER_NAME="Worker-$(hostname 2>/dev/null || echo 'generic')-$(id -u)"
fi

echo "=========================================================="
echo " Starting Socket Compute Worker Agent"
echo "=========================================================="
echo "  Hub URL:      $HUB_URL"
echo "  Worker Name:  $WORKER_NAME"
echo "  Run as User:  $(whoami) (UID: $(id -u))"
echo "  Root Access:  $([ $(id -u) -eq 0 ] && echo 'Yes' || echo 'No (User-Space)')"
echo "=========================================================="

get_os_info() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$NAME $VERSION_ID ($(uname -m))"
    else
        uname -srm
    fi
}

get_cpu_cores() {
    if command -v nproc >/dev/null 2>&1; then
        nproc
    elif [ -f /proc/cpuinfo ]; then
        grep -c '^processor' /proc/cpuinfo
    else
        echo "1"
    fi
}

get_cpu_usage() {
    if [ -f /proc/loadavg ]; then
        awk '{print $1 * 10}' /proc/loadavg | cut -d. -f1
    else
        echo "5"
    fi
}

get_mem_total() {
    if [ -f /proc/meminfo ]; then
        awk '/MemTotal/ {print int($2 / 1024)}' /proc/meminfo
    else
        echo "1024"
    fi
}

get_mem_used() {
    if [ -f /proc/meminfo ]; then
        awk '/MemTotal/ {t=$2} /MemAvailable/ {a=$2} END {print int((t-a)/1024)}' /proc/meminfo
    else
        echo "256"
    fi
}

get_disk_free() {
    df -k . 2>/dev/null | awk 'NR==2 {printf "%.1f", $4 / 1024 / 1024}' || echo "10.0"
}

NODE_ID="node_$(echo -n "${WORKER_NAME}_${WORKER_TOKEN}" | md5sum 2>/dev/null | cut -c1-12 || echo $RANDOM)"

echo "[*] Worker initialized. Node ID: $NODE_ID"
echo "[*] Registering heartbeat loop with hub..."

execute_task() {
    local task_id="$1"
    local command="$2"
    local title="$3"

    echo "[*] [TASK RECEIVED] ID: $task_id | Title: $title"
    local output=""
    local exit_code=0
    local status="completed"

    if [ -n "$command" ]; then
        echo "[*] Executing command: $command"
        output=$(eval "$command" 2>&1) || exit_code=$?
        if [ $exit_code -ne 0 ]; then
            status="failed"
        fi
    else
        output="Job executed successfully with default payload."
    fi

    echo "[*] Task finished (Exit: $exit_code, Status: $status)"

    # Escape output for JSON
    local escaped_output
    if command -v python3 >/dev/null 2>&1; then
        escaped_output=$(python3 -c "import json, sys; print(json.dumps(sys.argv[1]))" "$output")
    else
        escaped_output="\"$(echo "$output" | tr '\n' ' ' | sed 's/"/\\"/g')\""
    fi

    # Post result back to hub
    local result_json=$(cat <<EOF
{
  "status": "$status",
  "output": $escaped_output,
  "exit_code": $exit_code
}
EOF
)

    curl -s -X POST "$HUB_URL/api/v1/projects/default/compute/tasks/$task_id/result" \
        -H "Content-Type: application/json" \
        -d "$result_json" >/dev/null 2>&1 || true
}

while true; do
    CORES=$(get_cpu_cores)
    CPU_USAGE=$(get_cpu_usage)
    MEM_TOTAL=$(get_mem_total)
    MEM_USED=$(get_mem_used)
    DISK_FREE=$(get_disk_free)
    OS_INFO=$(get_os_info)

    JSON_PAYLOAD=$(cat <<EOF
{
  "node_id": "$NODE_ID",
  "name": "$WORKER_NAME",
  "auth_token": "$WORKER_TOKEN",
  "cpu_cores": $CORES,
  "cpu_usage_pct": $CPU_USAGE,
  "memory_total_mb": $MEM_TOTAL,
  "memory_used_mb": $MEM_USED,
  "disk_free_gb": $DISK_FREE,
  "os_info": "$OS_INFO",
  "role": "worker"
}
EOF
)

    RESPONSE=$(curl -s -X POST "$HUB_URL/api/v1/projects/default/compute/heartbeat" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD" 2>/dev/null || echo '{"error":"unreachable"}')

    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Heartbeat OK | CPU: ${CPU_USAGE}% | RAM: ${MEM_USED}/${MEM_TOTAL}MB"

        # Check for assigned tasks
        if command -v python3 >/dev/null 2>&1; then
            TASK_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('tasks', [])))" 2>/dev/null || echo 0)
            if [ "$TASK_COUNT" -gt 0 ]; then
                echo "[*] Found $TASK_COUNT pending task(s)! Processing..."
                # Process each task
                for ((i=0; i<$TASK_COUNT; i++)); do
                    TASK_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tasks'][$i].get('task_id', ''))" 2>/dev/null)
                    TASK_CMD=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tasks'][$i].get('command', ''))" 2>/dev/null)
                    TASK_TITLE=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tasks'][$i].get('title', ''))" 2>/dev/null)
                    execute_task "$TASK_ID" "$TASK_CMD" "$TASK_TITLE"
                done
            fi
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Hub Response: $RESPONSE"
    fi

    sleep "$POLL_INTERVAL"
done
