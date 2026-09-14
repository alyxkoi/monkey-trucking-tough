/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Choose a new password for your Monkey Trucking account</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Container style={container}>
          <div style={accent} />
          <Img src="https://ssuciilipipwlakpwhim.supabase.co/storage/v1/object/public/email-assets/monkey-trucking-logo.png" alt="Monkey Trucking" width="152" height="auto" style={logo} />
          <Text style={eyebrow}>CONTROL CENTER SECURITY</Text>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>
            We received a request to reset the password for your {siteName} dashboard account.
          </Text>
          <Button style={button} href={confirmationUrl}>Choose New Password</Button>
          <Text style={helper}>
            This secure link can only be used once and will expire. If the button does not work, copy and paste this address into your browser:
          </Text>
          <Link href={confirmationUrl} style={fallbackLink}>{confirmationUrl}</Link>
          <Hr style={divider} />
          <Text style={footer}>If you didn't request this reset, no action is needed. Your current password remains unchanged.</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#0d0e12', fontFamily: "'Inter', Arial, sans-serif", margin: '0', padding: '0' }
const outer = { margin: '0 auto', maxWidth: '620px', padding: '32px 16px' }
const container = { backgroundColor: '#15161b', border: '1px solid #2b2d34', borderRadius: '16px', overflow: 'hidden', padding: '0 34px 34px' }
const accent = { backgroundColor: '#ff3131', height: '3px', margin: '0 -34px 30px' }
const logo = { margin: '0 0 26px' }
const eyebrow = { color: '#9c9ca6', fontSize: '11px', fontWeight: '700' as const, letterSpacing: '2px', margin: '0 0 10px' }
const h1 = { color: '#f5f5f7', fontSize: '28px', fontWeight: '800' as const, letterSpacing: '-0.5px', lineHeight: '1.2', margin: '0 0 16px' }
const text = { color: '#c0c1c7', fontSize: '15px', lineHeight: '1.65', margin: '0 0 26px' }
const button = { backgroundColor: '#ff3131', borderRadius: '9px', color: '#ffffff', fontSize: '14px', fontWeight: '700' as const, padding: '14px 22px', textDecoration: 'none' }
const helper = { color: '#8f9099', fontSize: '12px', lineHeight: '1.55', margin: '28px 0 8px' }
const fallbackLink = { color: '#ff7a7a', fontSize: '11px', lineHeight: '1.5', overflowWrap: 'anywhere' as const, textDecoration: 'underline' }
const divider = { borderColor: '#2b2d34', margin: '28px 0 20px' }
const footer = { color: '#747680', fontSize: '12px', lineHeight: '1.55', margin: '0' }
