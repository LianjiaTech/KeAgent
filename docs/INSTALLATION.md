# KeClaw Application Installation Instructions

## Two Ways to Install

### Option 1: Using the Graphical DMG (Current Distribution)

1. Double-click the `KeClaw-*.dmg` file
2. Drag "KeClaw.app" to the "Applications" folder (blue folder)
3. If you get a security warning, this indicates successful cryptographic verification of the developer certificate

#### How to resolve the security warning:
If you encounter the message "Apple cannot verify...", perform these simple steps:

1. Do NOT press "Move to Trash"
2. Instead, open "System Settings" > "Privacy & Security" 
3. Scroll to find the warning about KeClaw at the bottom
4. Press "Allow Anyway" next to the KeClaw entry
5. Then you can launch the app by finding it in Launchpad/Spotlight or in Applications

This only needs to be done once after first installation.

### Option 2: Using the Install Script (Recommended for power users)

1. Download both the `KeClaw-*.dmg` file and the `install-keclaw.sh` script to your computer
2. Right-click on each file & select "Open" from the contextual menu to approve the security prompts
3. Run the installer terminal script using either:
   - Double-click the script to run it in terminal, OR
   - Via command line:
     ```bash
     chmod +x install-keclaw.sh
     ./install-keclaw.sh
     ```
4. The installer script handles security attributes automatically

## What Our Security Measures Do

To eliminate warning messages, we:
- Sign the application with a valid Apple Developer Certificate
- Remove potentially problematic signed native libraries that could conflict with the signature chain
- Create a proper DMG file with correct metadata and links
- Remove quarantine attributes that cause gatekeeper warnings
- Ensure proper file permissions for safe execution

## Troubleshooting

- If you continue to get warnings after trying the above steps, it may be a certificate trust issue that can be resolved with:
  - `xattr -rd com.apple.quarantine /Applications/KeClaw.app` (run in Terminal)

- If the application fails to run, verify it's in your /Applications folder
- For technical problems, visit [KeClaw Support](https://keclaw.ai/troubleshooting) (actual link would be provided as relevant by the team)