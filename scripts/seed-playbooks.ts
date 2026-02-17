import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const playbookTemplates = [
  {
    name: "Ransomware Response",
    description: "Standard operating procedure for ransomware incidents",
    incident_type: "ransomware",
    severity_trigger: "high",
    tasks: [
      { title: "Isolate affected systems from network", required: true, estimated_minutes: 15 },
      { title: "Identify ransomware variant", required: true, estimated_minutes: 30 },
      { title: "Document encrypted files and ransom note", required: true, estimated_minutes: 20 },
      { title: "Check backups for integrity", required: true, estimated_minutes: 30 },
      { title: "Notify legal and compliance teams", required: true, estimated_minutes: 15 },
      { title: "Assess decryption options", required: false, estimated_minutes: 60 },
      { title: "Restore from clean backups", required: true, estimated_minutes: 120 },
      { title: "Verify system integrity post-recovery", required: true, estimated_minutes: 45 },
      { title: "Document lessons learned", required: true, estimated_minutes: 30 },
    ],
  },
  {
    name: "Phishing Investigation",
    description: "Process for investigating suspected phishing emails",
    incident_type: "phishing",
    severity_trigger: "medium",
    tasks: [
      { title: "Quarantine suspicious email", required: true, estimated_minutes: 5 },
      { title: "Analyze email headers and sender", required: true, estimated_minutes: 15 },
      { title: "Check for malicious links or attachments", required: true, estimated_minutes: 20 },
      { title: "Identify affected users", required: true, estimated_minutes: 15 },
      { title: "Reset credentials if compromised", required: true, estimated_minutes: 10 },
      { title: "Block sender domain/IP", required: true, estimated_minutes: 10 },
      { title: "Send awareness notification to organization", required: false, estimated_minutes: 20 },
      { title: "Update email filters", required: true, estimated_minutes: 15 },
    ],
  },
  {
    name: "Data Breach Response",
    description: "Comprehensive data breach investigation and response",
    incident_type: "data_breach",
    severity_trigger: "critical",
    tasks: [
      { title: "Contain the breach immediately", required: true, estimated_minutes: 30 },
      { title: "Identify scope of compromised data", required: true, estimated_minutes: 60 },
      { title: "Preserve evidence for forensics", required: true, estimated_minutes: 45 },
      { title: "Notify legal and executive team", required: true, estimated_minutes: 20 },
      { title: "Assess regulatory notification requirements", required: true, estimated_minutes: 30 },
      { title: "Prepare breach notification communications", required: true, estimated_minutes: 90 },
      { title: "Notify affected individuals", required: true, estimated_minutes: 60 },
      { title: "Engage external forensics if needed", required: false, estimated_minutes: 30 },
      { title: "Implement additional security controls", required: true, estimated_minutes: 120 },
      { title: "Conduct post-incident review", required: true, estimated_minutes: 60 },
    ],
  },
  {
    name: "Malware Infection",
    description: "Response procedure for malware detection and removal",
    incident_type: "malware",
    severity_trigger: "high",
    tasks: [
      { title: "Isolate infected system", required: true, estimated_minutes: 10 },
      { title: "Identify malware type and behavior", required: true, estimated_minutes: 30 },
      { title: "Check for lateral movement", required: true, estimated_minutes: 45 },
      { title: "Collect forensic artifacts", required: true, estimated_minutes: 30 },
      { title: "Remove malware using approved tools", required: true, estimated_minutes: 60 },
      { title: "Scan all connected systems", required: true, estimated_minutes: 90 },
      { title: "Update antivirus signatures", required: true, estimated_minutes: 15 },
      { title: "Restore from clean backup if needed", required: false, estimated_minutes: 120 },
      { title: "Monitor for reinfection", required: true, estimated_minutes: 30 },
    ],
  },
  {
    name: "Unauthorized Access",
    description: "Investigation of unauthorized system or account access",
    incident_type: "unauthorized_access",
    severity_trigger: "high",
    tasks: [
      { title: "Disable compromised accounts", required: true, estimated_minutes: 10 },
      { title: "Review access logs", required: true, estimated_minutes: 45 },
      { title: "Identify entry point", required: true, estimated_minutes: 60 },
      { title: "Assess data accessed or exfiltrated", required: true, estimated_minutes: 45 },
      { title: "Force password reset for affected users", required: true, estimated_minutes: 20 },
      { title: "Enable MFA if not already active", required: true, estimated_minutes: 30 },
      { title: "Review and update access controls", required: true, estimated_minutes: 45 },
      { title: "Monitor for suspicious activity", required: true, estimated_minutes: 30 },
      { title: "Document attack vector and remediation", required: true, estimated_minutes: 30 },
    ],
  },
];

async function seedPlaybooks() {
  console.log("🌱 Seeding playbook templates...");

  // Get all organizations
  const { data: orgs, error: orgsError } = await supabase
    .from("organizations")
    .select("id, name");

  if (orgsError) {
    console.error("Error fetching organizations:", orgsError);
    return;
  }

  if (!orgs || orgs.length === 0) {
    console.log("⚠️  No organizations found. Create an organization first.");
    return;
  }

  console.log(`Found ${orgs.length} organization(s)`);

  for (const org of orgs) {
    console.log(`\n📋 Seeding playbooks for: ${org.name}`);

    // Get first admin user for this org
    const { data: members } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", org.id)
      .eq("role", "admin")
      .limit(1);

    if (!members || members.length === 0) {
      console.log(`  ⚠️  No admin found for ${org.name}, skipping`);
      continue;
    }

    const adminUserId = members[0].user_id;

    for (const template of playbookTemplates) {
      // Check if playbook already exists
      const { data: existing } = await supabase
        .from("playbooks")
        .select("id")
        .eq("org_id", org.id)
        .eq("name", template.name)
        .single();

      if (existing) {
        console.log(`  ⏭️  Skipping "${template.name}" (already exists)`);
        continue;
      }

      // Create playbook
      const { data: playbook, error: playbookError } = await supabase
        .from("playbooks")
        .insert({
          org_id: org.id,
          name: template.name,
          description: template.description,
          incident_type: template.incident_type,
          severity_trigger: template.severity_trigger,
          created_by: adminUserId,
        })
        .select()
        .single();

      if (playbookError) {
        console.error(`  ❌ Error creating "${template.name}":`, playbookError);
        continue;
      }

      // Create tasks
      const tasks = template.tasks.map((task, index) => ({
        playbook_id: playbook.id,
        order_num: index + 1,
        title: task.title,
        required: task.required,
        estimated_minutes: task.estimated_minutes,
      }));

      const { error: tasksError } = await supabase
        .from("playbook_tasks")
        .insert(tasks);

      if (tasksError) {
        console.error(`  ❌ Error creating tasks for "${template.name}":`, tasksError);
        continue;
      }

      console.log(`  ✅ Created "${template.name}" with ${tasks.length} tasks`);
    }
  }

  console.log("\n✨ Playbook seeding complete!");
}

seedPlaybooks().catch(console.error);
