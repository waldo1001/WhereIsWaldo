import SwiftUI

extension Color {
    /// `0xRRGGBB` convenience initializer for the fixed design-token defaults below.
    init(hex: UInt32) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

/// specs/004-ios-client.md §2.1 — the semantic color vocabulary, identical to the Android client's
/// token names. Components read these fields ONLY, never a literal `Color(...)`.
public struct ColorTokens: Equatable {
    public var primary: Color
    public var onPrimary: Color
    public var secondary: Color
    public var surface: Color
    public var onSurface: Color
    public var surfaceVariant: Color
    public var danger: Color
    public var onDanger: Color
    public var success: Color
    public var warning: Color
    public var outline: Color

    public init(
        primary: Color, onPrimary: Color, secondary: Color, surface: Color, onSurface: Color,
        surfaceVariant: Color, danger: Color, onDanger: Color, success: Color, warning: Color, outline: Color
    ) {
        self.primary = primary
        self.onPrimary = onPrimary
        self.secondary = secondary
        self.surface = surface
        self.onSurface = onSurface
        self.surfaceVariant = surfaceVariant
        self.danger = danger
        self.onDanger = onDanger
        self.success = success
        self.warning = warning
        self.outline = outline
    }

    public static let light = ColorTokens(
        primary: Color(hex: 0x2F6FED), onPrimary: Color(hex: 0xFFFFFF), secondary: Color(hex: 0x5856D6),
        surface: Color(hex: 0xFFFFFF), onSurface: Color(hex: 0x1C1C1E), surfaceVariant: Color(hex: 0xF2F2F7),
        danger: Color(hex: 0xD70015), onDanger: Color(hex: 0xFFFFFF), success: Color(hex: 0x248A3D),
        warning: Color(hex: 0xFF9500), outline: Color(hex: 0xC6C6C8)
    )

    public static let dark = ColorTokens(
        primary: Color(hex: 0x6C9BFF), onPrimary: Color(hex: 0x04174D), secondary: Color(hex: 0x9D9CFF),
        surface: Color(hex: 0x1C1C1E), onSurface: Color(hex: 0xF2F2F7), surfaceVariant: Color(hex: 0x2C2C2E),
        danger: Color(hex: 0xFF6961), onDanger: Color(hex: 0x340003), success: Color(hex: 0x63D471),
        warning: Color(hex: 0xFFB340), outline: Color(hex: 0x48484A)
    )
}
